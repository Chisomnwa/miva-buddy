import { NextResponse } from "next/server";
import { groundedLearnRequestSchema } from "@/contracts/grounded-learning";
import { isSameOriginRequest } from "@/lib/same-origin";
import { getPermanentUser } from "@/lib/auth/permanent-user";
import { createGenerationProvider } from "@/server/ai/create-provider";
import type { GenerationMessage } from "@/server/ai/provider";
import { generateGroundedLearningReply, isMaterialSpecificQuestion, noCourseSupportReply } from "@/server/ai/grounded-learning";
import { CourseRetrievalUnavailableError, retrieveCourseEvidence } from "@/server/retrieval/course-retrieval";
import { createIndustryDemonstration } from "@/server/job-evidence/demo";
import { createRemoteOkJobEvidenceProvider, isRemoteOkMetadataPilotEnabled, remoteOkMetadataGrant } from "@/server/job-evidence/remoteok-provider";
import { createHimalayasJobEvidenceProvider, isHimalayasMetadataEnabled } from "@/server/job-evidence/himalayas-provider";
import { searchJobEvidence } from "@/server/job-evidence/search";
import { searchCourseHimalayasReferences } from "@/server/job-evidence/course-himalayas";
import { skillsExplicitlyInCourse } from "@/server/job-evidence/skills";
import { getServerConfig } from "@/lib/config";
import { recordSafeOperation } from "@/server/observability/safe-telemetry";
import { GeminiUsageProtectionError } from "@/server/ai/gemini-usage-errors";
import { classifySafeProviderFailure } from "@/server/ai/gemini-provider-errors";

const maxRequestBytes = 16_384;
const maxMessagesPerMinute = 8;
const generationTimeoutMs = 45_000;
const remoteOkProvider = createRemoteOkJobEvidenceProvider();
const himalayasProvider = createHimalayasJobEvidenceProvider();

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

function historyText(role: string, content: string, responseSegments: unknown): GenerationMessage {
  if (role !== "assistant" || !Array.isArray(responseSegments)) return { role: role as "user" | "assistant", content };
  const segments = responseSegments.flatMap((item) => {
    if (!item || typeof item !== "object" || !("kind" in item) || !("content" in item)
      || typeof item.content !== "string") return [];
    return [`${item.kind === "grounded" ? "From course material" : "Additional explanation"}: ${item.content}`];
  });
  return { role: "assistant", content: segments.join("\n\n") || content };
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return json({ error: "invalid_origin" }, 403);
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    return json({ error: "invalid_request" }, 415);
  }
  let body: unknown;
  try {
    body = await readJsonBounded(request);
  } catch (error) {
    return json({ error: error instanceof RangeError ? "request_too_large" : "invalid_request" }, error instanceof RangeError ? 413 : 400);
  }
  const parsed = groundedLearnRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: "invalid_request" }, 400);

  const { supabase, user } = await getPermanentUser();
  if (!user) return json({ error: "not_authenticated" }, 401);
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count, error: limitError } = await supabase.from("learn_messages")
    .select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("role", "user").gte("created_at", since);
  if (limitError) return json({ error: "learning_unavailable" }, 503);
  if ((count ?? 0) >= maxMessagesPerMinute) return json({ error: "rate_limited" }, 429);

  const { data: course, error: courseError } = await supabase.from("courses")
    .select("id,title").eq("id", parsed.data.courseId).eq("user_id", user.id).maybeSingle();
  if (courseError || !course) return json({ error: "course_not_found" }, 404);
  const { data: material, error: materialError } = await supabase.from("course_materials")
    .select("id,title,status").eq("id", parsed.data.materialId).eq("course_id", course.id).eq("user_id", user.id).maybeSingle();
  if (materialError || !material || material.status !== "ready") return json({ error: "material_not_ready" }, 404);
  const { data: concept, error: conceptError } = await supabase.from("course_concepts")
    .select("id,title").eq("id", parsed.data.conceptId).eq("material_id", material.id).eq("course_id", course.id).eq("user_id", user.id).maybeSingle();
  if (conceptError || !concept) return json({ error: "concept_not_found" }, 404);

  let conversationId = parsed.data.conversationId;
  if (conversationId) {
    const { data: conversation, error } = await supabase.from("learn_conversations")
      .select("id,course_id,material_id,concept_id")
      .eq("id", conversationId).eq("user_id", user.id).maybeSingle();
    if (error) return json({ error: "learning_unavailable" }, 503);
    if (!conversation || conversation.course_id !== course.id || conversation.material_id !== material.id
      || conversation.concept_id !== concept.id) return json({ error: "conversation_not_found" }, 404);
  } else {
    const title = parsed.data.message.replace(/\s+/g, " ").trim().slice(0, 120);
    const { data: conversation, error } = await supabase.from("learn_conversations").insert({
      user_id: user.id,
      title,
      course_id: course.id,
      material_id: material.id,
      concept_id: concept.id,
    }).select("id").single();
    if (error || !conversation) return json({ error: "learning_unavailable" }, 503);
    conversationId = conversation.id;
  }

  const { data: history, error: historyError } = await supabase.from("learn_messages")
    .select("role,content,response_segments")
    .eq("conversation_id", conversationId).eq("user_id", user.id)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(6);
  if (historyError || !history) return json({ error: "learning_unavailable", conversationId }, 503);
  const historyMessages: GenerationMessage[] = history.reverse().map((row) => historyText(row.role, row.content, row.response_segments));
  const { error: saveQuestionError } = await supabase.from("learn_messages").insert({
    conversation_id: conversationId,
    user_id: user.id,
    role: "user",
    content: parsed.data.message,
  });
  if (saveQuestionError) return json({ error: "learning_unavailable", conversationId }, 503);

  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(generationTimeoutMs)]);
  let evidence;
  try {
    evidence = await retrieveCourseEvidence(supabase, {
      courseId: course.id,
      materialId: material.id,
      conceptId: concept.id,
      question: parsed.data.message,
      signal,
      usageUserId: user.id,
    });
  } catch (error) {
    if (error instanceof GeminiUsageProtectionError && error.reason !== "unavailable") return json({ error: "gemini_usage_limit", conversationId }, 429);
    if (error instanceof GeminiUsageProtectionError) return json({ error: "learning_unavailable", conversationId }, 503);
    const providerFailure = classifySafeProviderFailure(error);
    if (providerFailure) return json({ error: providerFailure.code, conversationId }, providerFailure.status);
    if (error instanceof CourseRetrievalUnavailableError) return json({ error: "retrieval_unavailable", conversationId }, 503);
    return json({ error: "retrieval_unavailable", conversationId }, 503);
  }

  let reply;
  const providerStartedAt = Date.now();
  let providerName: "fake" | "ollama" | "gemini" | "groq" | "unknown" = "unknown";
  try {
    if (evidence.status === "no_sufficient_support" && isMaterialSpecificQuestion(parsed.data.message)) {
      reply = noCourseSupportReply();
    } else {
      providerName = getServerConfig().AI_PROVIDER;
      const provider = createGenerationProvider();
      reply = await generateGroundedLearningReply(provider, {
        question: parsed.data.message,
        excerpts: evidence.status === "supporting_evidence_found" ? evidence.chunks : [],
        history: historyMessages,
        signal,
        usageUserId: user.id,
      });
      recordSafeOperation({ operation: "grounded_learn", provider: providerName, outcome: "success", durationMs: Date.now() - providerStartedAt });
    }
  } catch (error) {
    recordSafeOperation({ operation: "grounded_learn", provider: providerName, outcome: "failure", durationMs: Date.now() - providerStartedAt });
    if (error instanceof GeminiUsageProtectionError && error.reason !== "unavailable") return json({ error: "gemini_usage_limit", conversationId }, 429);
    if (error instanceof GeminiUsageProtectionError) return json({ error: "learning_unavailable", conversationId }, 503);
    const providerFailure = classifySafeProviderFailure(error);
    if (providerFailure) return json({ error: providerFailure.code, conversationId }, providerFailure.status);
    return json({ error: "provider_unavailable", conversationId }, 503);
  }
  let groundedSegments = reply.segments.filter((segment) => segment.kind === "grounded");
  if (evidence.status === "no_sufficient_support" && isMaterialSpecificQuestion(parsed.data.message)) {
    reply = noCourseSupportReply();
    groundedSegments = [];
  } else if (isMaterialSpecificQuestion(parsed.data.message) && groundedSegments.length === 0) {
    reply = noCourseSupportReply();
  }
  const validatedGroundingStatus = groundedSegments.length > 0 && evidence.status === "supporting_evidence_found"
    ? "supporting_evidence_found" : "no_sufficient_support";
  const flattenedContent = reply.segments.map((segment) => segment.content).join("\n\n").slice(0, 8_000);
  const { error: saveAnswerError } = await supabase.from("learn_messages").insert({
    conversation_id: conversationId,
    user_id: user.id,
    role: "assistant",
    content: flattenedContent,
    follow_up_questions: reply.followUpQuestions,
    response_segments: reply.segments,
    grounding_status: validatedGroundingStatus,
  });
  if (saveAnswerError) return json({ error: "learning_unavailable", conversationId }, 503);
  await supabase.from("learn_conversations").update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId).eq("user_id", user.id);
  const industryDemonstration = evidence.status === "supporting_evidence_found"
    ? createIndustryDemonstration(evidence.chunks, process.env.NODE_ENV ?? "production")
    : null;
  let industryReferences = null;
  const terms = evidence.status === "supporting_evidence_found" ? skillsExplicitlyInCourse(evidence.chunks) : [];
  if (isRemoteOkMetadataPilotEnabled(process.env.NODE_ENV, process.env.REMOTEOK_METADATA_PILOT)
    && evidence.status === "supporting_evidence_found") {
    if (terms.length > 0) {
      industryReferences = await searchJobEvidence(remoteOkProvider, { terms }, remoteOkMetadataGrant, "metadata", signal);
    }
  }
  const himalayasReferences = await searchCourseHimalayasReferences(
    evidence,
    isHimalayasMetadataEnabled(process.env.NODE_ENV, process.env.HIMALAYAS_METADATA_ENABLED),
    himalayasProvider,
    signal,
  );
  return json({ conversationId, industryDemonstration, industryReferences, himalayasReferences });
}
