import { NextResponse } from "next/server";
import { learnRequestSchema } from "@/contracts/learning";
import { getServerConfig } from "@/lib/config";
import { isSameOriginRequest } from "@/lib/same-origin";
import { createClient } from "@/lib/supabase/server";
import { createGenerationProvider } from "@/server/ai/create-provider";
import { learningSystemPrompt, selectRecentContext } from "@/server/ai/learning-prompt";
import { MalformedProviderOutputError, type GenerationMessage } from "@/server/ai/provider";
import { generateLearningReply } from "@/server/ai/structured-learning";
import { recordSafeOperation } from "@/server/observability/safe-telemetry";
import { buildInterviewPreparation, interviewMessageContent, recoverPreviousInterviewPreparationSegment } from "@/server/interview-preparation/prepare";

const maxRequestBytes = 16_384;
const maxMessagesPerMinute = 8;
const generationTimeoutMs = 45_000;

function json(data: object, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

async function readJsonBounded(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing request body");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxRequestBytes) {
      await reader.cancel();
      throw new RangeError("Request too large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return json({ error: "invalid_origin" }, 403);
  }
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    return json({ error: "invalid_request" }, 415);
  }

  let body: unknown;
  try {
    body = await readJsonBounded(request);
  } catch (error) {
    return json({ error: error instanceof RangeError ? "request_too_large" : "invalid_request" }, error instanceof RangeError ? 413 : 400);
  }
  const parsed = learnRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: "invalid_request" }, 400);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "not_authenticated" }, 401);

  const since = new Date(Date.now() - 60_000).toISOString();
  const { count, error: limitError } = await supabase
    .from("learn_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("role", "user")
    .gte("created_at", since);
  if (limitError) return json({ error: "learning_unavailable" }, 503);
  if ((count ?? 0) >= maxMessagesPerMinute) return json({ error: "rate_limited" }, 429);

  let conversationId = parsed.data.conversationId;
  if (conversationId) {
    const { data: conversation, error } = await supabase
      .from("learn_conversations")
      .select("id, course_id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) return json({ error: "learning_unavailable" }, 503);
    if (!conversation || conversation.course_id !== null) return json({ error: "conversation_not_found" }, 404);
  } else {
    const title = parsed.data.message.replace(/\s+/g, " ").trim().slice(0, 120);
    const { data: conversation, error } = await supabase
      .from("learn_conversations")
      .insert({ user_id: user.id, title })
      .select("id")
      .single();
    if (error || !conversation) return json({ error: "learning_unavailable" }, 503);
    conversationId = conversation.id;
  }

  const { error: saveQuestionError } = await supabase.from("learn_messages").insert({
    conversation_id: conversationId,
    user_id: user.id,
    role: "user",
    content: parsed.data.message,
  });
  if (saveQuestionError) return json({ error: "learning_unavailable" }, 503);

  const { error: touchError } = await supabase
    .from("learn_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("user_id", user.id);
  if (touchError) return json({ error: "learning_unavailable", conversationId }, 503);

  const { data: history, error: historyError } = await supabase
    .from("learn_messages")
    .select("role, content, response_segments")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(8);
  if (historyError || !history) return json({ error: "learning_unavailable", conversationId }, 503);

  const orderedHistory = history.reverse();
  const priorAssistantMessage = [...orderedHistory].reverse().find((message) => message.role === "assistant");
  const priorAssistantSegments =
    Array.isArray(priorAssistantMessage?.response_segments) ? priorAssistantMessage.response_segments : [];
  const priorUserMessages = orderedHistory.filter((message) => message.role === "user");
  const previousInterviewSegment = recoverPreviousInterviewPreparationSegment(
    priorAssistantSegments,
    priorUserMessages.slice(0, -1).map((message) => message.content),
  );
  const interviewPreparation = buildInterviewPreparation({
    message: parsed.data.message,
    previousAssistantSegment: previousInterviewSegment ?? undefined,
  });
  const messages: GenerationMessage[] = [
    { role: "system", content: learningSystemPrompt },
    ...selectRecentContext(orderedHistory.map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
    }))),
  ];

  let reply: { answer: string; followUpQuestions: string[] };
  let responseSegments: unknown[] = [];
  const providerStartedAt = Date.now();
  let providerName: "fake" | "ollama" | "gemini" | "groq" | "unknown" = "unknown";
  if (interviewPreparation) {
    reply = {
      answer: interviewMessageContent(interviewPreparation),
      followUpQuestions: interviewPreparation.followUpQuestions,
    };
    responseSegments = [interviewPreparation];
  } else {
    try {
      const config = getServerConfig();
      providerName = config.AI_PROVIDER;
      const provider = createGenerationProvider();
      if (config.AI_PROVIDER === "fake" && process.env.NODE_ENV === "production") {
        return json({ error: "provider_unavailable", conversationId }, 503);
      }
      const signal = AbortSignal.any([request.signal, AbortSignal.timeout(generationTimeoutMs)]);
      reply = await generateLearningReply(provider, messages, signal);
      recordSafeOperation({ operation: "learn", provider: providerName, outcome: "success", durationMs: Date.now() - providerStartedAt });
    } catch (error) {
      const outcome = request.signal.aborted ? "cancelled" : error instanceof MalformedProviderOutputError ? "invalid_output" : "failure";
      recordSafeOperation({ operation: "learn", provider: providerName, outcome, durationMs: Date.now() - providerStartedAt });
      if (request.signal.aborted) return json({ error: "request_cancelled", conversationId }, 499);
      return json({
        error: error instanceof MalformedProviderOutputError ? "invalid_provider_response" : "provider_unavailable",
        conversationId,
      }, error instanceof MalformedProviderOutputError ? 502 : 503);
    }
  }

  const { error: saveAnswerError } = await supabase.from("learn_messages").insert({
    conversation_id: conversationId,
    user_id: user.id,
    role: "assistant",
    content: reply.answer,
    follow_up_questions: reply.followUpQuestions,
    response_segments: responseSegments,
  });
  if (saveAnswerError) return json({ error: "learning_unavailable", conversationId }, 503);

  const { error: finalTouchError } = await supabase
    .from("learn_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("user_id", user.id);
  if (finalTouchError) return json({ error: "learning_unavailable", conversationId }, 503);

  return json({ conversationId });
}
