import { NextResponse } from "next/server";
import { practiceCoachRequestSchema, practiceCoachResponseSchema } from "@/contracts/practice-coaching";
import { isSameOriginRequest } from "@/lib/same-origin";
import { getPermanentUser } from "@/lib/auth/permanent-user";
import { createGenerationProvider } from "@/server/ai/create-provider";
import { MalformedProviderOutputError } from "@/server/ai/provider";
import { classifyPracticeRequest, evaluateModeRequest, isExplicitFullAnswerRequest } from "@/server/practice/coaching-policy";
import { generatePracticeCoachingReply } from "@/server/practice/coaching";
import { getPracticeProblem } from "@/server/practice/catalog";
import { getServerConfig } from "@/lib/config";
import { recordSafeOperation } from "@/server/observability/safe-telemetry";
import { GeminiUsageProtectionError } from "@/server/ai/gemini-usage-errors";
import { classifySafeProviderFailure, safeProviderFailureMessage } from "@/server/ai/gemini-provider-errors";

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
    if (total > maxRequestBytes) { await reader.cancel(); throw new RangeError("Request too large"); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

function responseText(response: { segments: { content: string }[] }) {
  return response.segments.map((segment) => segment.content).join("\n\n");
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return json({ error: "invalid_origin" }, 403);
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") return json({ error: "invalid_request" }, 415);
  let body: unknown;
  try { body = await readJsonBounded(request); }
  catch (error) { return json({ error: error instanceof RangeError ? "request_too_large" : "invalid_request" }, error instanceof RangeError ? 413 : 400); }
  const parsed = practiceCoachRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: "invalid_request" }, 400);

  const { supabase, user } = await getPermanentUser();
  if (!user) return json({ error: "not_authenticated" }, 401);

  const { data: session, error: sessionError } = await supabase.from("practice_sessions")
    .select("id,mode,status,problem_slug").eq("id", parsed.data.sessionId).eq("user_id", user.id).maybeSingle();
  if (sessionError) return json({ error: "coaching_unavailable" }, 503);
  if (!session) return json({ error: "session_not_found" }, 404);
  if (session.status !== "in_progress") return json({ error: "session_completed" }, 409);
  const problem = getPracticeProblem(session.problem_slug);
  if (!problem) return json({ error: "coaching_unavailable" }, 503);

  const since = new Date(Date.now() - 60_000).toISOString();
  const { count, error: limitError } = await supabase.from("practice_messages")
    .select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("role", "user").gte("created_at", since);
  if (limitError) return json({ error: "coaching_unavailable" }, 503);
  if ((count ?? 0) >= maxMessagesPerMinute) return json({ error: "rate_limited" }, 429);

  const { data: savedUser, error: saveUserError } = await supabase.from("practice_messages").insert({
    session_id: session.id, user_id: user.id, role: "user", content: parsed.data.message,
    attempt: parsed.data.attempt || null, mode: session.mode, request_type: classifyPracticeRequest(parsed.data.message), response_payload: null,
  }).select("id").single();
  if (saveUserError || !savedUser) return json({ error: "coaching_unavailable" }, 503);

  const modeDecision = evaluateModeRequest(session.mode as "hands_off" | "coach" | "tutor", parsed.data.message);
  if (!modeDecision.allowed) {
    console.info("Practice coaching policy decision", { mode: session.mode, requestType: classifyPracticeRequest(parsed.data.message), decision: "mode_limit", explicitFullAnswer: isExplicitFullAnswerRequest(parsed.data.message) });
    const notice = { segments: [{ kind: "reflection_question", content: modeDecision.message, format: "prose", references: [] }] };
    const { error: saveLimitError } = await supabase.from("practice_messages").insert({
      session_id: session.id, user_id: user.id, role: "assistant", content: modeDecision.message,
      mode: session.mode, request_type: classifyPracticeRequest(parsed.data.message), response_payload: notice,
    });
    if (saveLimitError) return json({ error: "coaching_unavailable" }, 503);
    return json({ status: "mode_limit", message: modeDecision.message, offerTutorSwitch: modeDecision.offerTutorSwitch });
  }

  let response;
  let requestType: string;
  const providerStartedAt = Date.now();
  let providerName: "fake" | "ollama" | "gemini" | "groq" | "unknown" = "unknown";
  const { data: history, error: historyError } = await supabase.from("practice_messages")
    .select("id,role,content,attempt,response_payload").eq("session_id", session.id).eq("user_id", user.id).neq("id", savedUser.id)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(6);
  if (historyError || !history) return json({ error: "coaching_unavailable" }, 503);
  const recentHistory = history.reverse();
  const contextAttempt = parsed.data.attempt || [...recentHistory].reverse().find((entry) => entry.role === "user" && entry.attempt)?.attempt || "";
  if (!contextAttempt.trim()) {
    requestType = "other";
    response = { segments: [{ kind: "reflection_question" as const, content: "Could you share a short part of your attempt, your reasoning, or the exact error you’re seeing? I’ll respond to what you provide.", format: "prose" as const, references: [] }] };
  } else {
    try {
      providerName = getServerConfig().AI_PROVIDER;
      const provider = createGenerationProvider();
      const configEnv = process.env.AI_PROVIDER;
      if ((!configEnv || configEnv === "fake") && process.env.NODE_ENV === "production") return json({ error: "provider_unavailable" }, 503);
      const generated = await generatePracticeCoachingReply({
        provider,
        mode: session.mode as "hands_off" | "coach" | "tutor",
        message: parsed.data.message,
        attempt: contextAttempt,
        history: recentHistory.map((entry) => ({
          role: entry.role as "user" | "assistant", content: entry.content,
          attempt: entry.attempt, payload: entry.response_payload,
        })),
        problem,
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(generationTimeoutMs)]),
        usageUserId: user.id,
        onRejected: (attempt, reason) => console.warn("Practice coaching candidate rejected by policy", { attempt, reason, mode: session.mode }),
      });
      response = generated.response;
      requestType = generated.requestType;
      recordSafeOperation({ operation: "practice_coaching", provider: providerName, outcome: "success", durationMs: Date.now() - providerStartedAt });
    } catch (error) {
      const outcome = request.signal.aborted ? "cancelled" : error instanceof MalformedProviderOutputError ? "invalid_output" : "failure";
      recordSafeOperation({ operation: "practice_coaching", provider: providerName, outcome, durationMs: Date.now() - providerStartedAt });
      if (request.signal.aborted) return json({ error: "request_cancelled" }, 499);
      if (error instanceof GeminiUsageProtectionError && error.reason !== "unavailable") {
        return json({ error: "gemini_usage_limit", message: "The shared AI usage limit has been reached for now. Please try again later." }, 429);
      }
      if (error instanceof GeminiUsageProtectionError) {
        return json({ error: "coaching_unavailable", message: "AI is temporarily unavailable. Please try again shortly." }, 503);
      }
      const providerFailure = classifySafeProviderFailure(error);
      if (providerFailure) {
        return json({ error: providerFailure.code, message: safeProviderFailureMessage(providerFailure.code) }, providerFailure.status);
      }
      const code = error instanceof MalformedProviderOutputError ? "invalid_candidate" : "provider_or_policy_failure";
      console.warn("Practice coaching request failed safely", { code, mode: session.mode });
      return json({ error: "coaching_failed", message: "We couldn’t safely prepare a response. Your message is saved; please try again with a short attempt or rephrase your question." }, 502);
    }
  }

  const checked = practiceCoachResponseSchema.safeParse(response);
  if (!checked.success) return json({ error: "coaching_failed" }, 502);
  console.info("Practice coaching policy decision", { mode: session.mode, requestType, decision: "accepted", explicitFullAnswer: isExplicitFullAnswerRequest(parsed.data.message) });
  const { data: assistant, error: saveAssistantError } = await supabase.from("practice_messages").insert({
    session_id: session.id, user_id: user.id, role: "assistant", content: responseText(checked.data),
    mode: session.mode, request_type: requestType, response_payload: checked.data,
  }).select("id").single();
  if (saveAssistantError || !assistant) return json({ error: "coaching_unavailable" }, 503);
  await supabase.from("practice_sessions").update({ updated_at: new Date().toISOString() }).eq("id", session.id).eq("user_id", user.id);
  return json({ status: contextAttempt.trim() ? "accepted" : "needs_attempt", userMessageId: savedUser.id, assistantMessageId: assistant.id, response: checked.data });
}
