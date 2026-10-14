import { NextResponse } from "next/server";
import { courseFlashcardsRequestSchema, type CourseFlashcardsError } from "@/contracts/course-flashcards";
import { courseFlashcardSourceVersion } from "@/lib/course-flashcard-source-version";
import { AuthVerificationError, getPermanentUser } from "@/lib/auth/permanent-user";
import { isSameOriginRequest } from "@/lib/same-origin";
import { createGenerationProvider } from "@/server/ai/create-provider";
import { classifyCourseFlashcardGenerationError, generateCourseFlashcards } from "@/server/ai/course-flashcards";
import { getServerConfig } from "@/lib/config";
import { recordSafeOperation, type SafeFailureCategory } from "@/server/observability/safe-telemetry";

const maxRequestBytes = 4_096;
const maxGenerationsPerMinute = 5;
const generationTimeoutMs = 45_000;
const generationTimes = new Map<string, number[]>();

function telemetryCategory(error: CourseFlashcardsError): SafeFailureCategory {
  switch (error) {
    case "generation_timeout": return "timeout";
    case "provider_unavailable": return "provider_network";
    case "provider_quota": return "provider_usage_limit";
    case "provider_configuration": return "provider_configuration";
    case "provider_rejected": return "provider_rejected";
    case "invalid_generation": return "invalid_generation";
    case "rate_limited":
    case "usage_limit": return "rate_limited";
    case "sources_unavailable": return "sources_unavailable";
    default: return "unexpected";
  }
}

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

function allowGeneration(userId: string, now = Date.now()) {
  for (const [key, times] of generationTimes) {
    const current = times.filter((time) => now - time < 60_000);
    if (current.length) generationTimes.set(key, current);
    else generationTimes.delete(key);
  }
  const recent = generationTimes.get(userId) ?? [];
  if (recent.length >= maxGenerationsPerMinute) return false;
  recent.push(now);
  generationTimes.set(userId, recent);
  return true;
}

async function postFlashcards(request: Request) {
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
  const parsed = courseFlashcardsRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: "invalid_request" }, 400);

  let auth: Awaited<ReturnType<typeof getPermanentUser>>;
  try {
    auth = await getPermanentUser();
  } catch (error) {
    if (error instanceof AuthVerificationError) return json({ error: "auth_verification_unavailable" }, 503);
    throw error;
  }
  const { supabase, user } = auth;
  if (!user) return json({ error: "not_authenticated" }, 401);

  const { data: course, error: courseError } = await supabase.from("courses")
    .select("id").eq("id", parsed.data.courseId).eq("user_id", user.id).maybeSingle();
  if (courseError || !course) return json({ error: "course_not_found" }, 404);
  const { data: material, error: materialError } = await supabase.from("course_materials")
    .select("id,title,status,updated_at")
    .eq("id", parsed.data.materialId).eq("course_id", course.id).eq("user_id", user.id).maybeSingle();
  if (materialError || !material || material.status !== "ready") return json({ error: "material_not_ready" }, 404);
  const { data: concept, error: conceptError } = await supabase.from("course_concepts")
    .select("id,title,description,extraction_version")
    .eq("id", parsed.data.conceptId).eq("material_id", material.id).eq("course_id", course.id).eq("user_id", user.id).maybeSingle();
  if (conceptError || !concept) return json({ error: "concept_not_found" }, 404);

  const { data: sourceRows, error: sourceError } = await supabase.from("course_concept_sources")
    .select("chunk_id")
    .eq("concept_id", concept.id).eq("material_id", material.id).eq("user_id", user.id);
  if (sourceError) {
    recordSafeOperation({ operation: "course_flashcards", provider: "unknown", outcome: "failure", durationMs: 0, failureCategory: "sources_unavailable" });
    return json({ error: "sources_unavailable" }, 503);
  }
  const sourceChunkIds = [...new Set((sourceRows ?? []).map((source) => source.chunk_id))];
  const sourceVersion = courseFlashcardSourceVersion({
    materialUpdatedAt: material.updated_at,
    extractionVersion: concept.extraction_version,
    sourceChunkIds,
  });
  if (sourceVersion !== parsed.data.sourceVersion) return json({ error: "source_changed" }, 409);
  if (sourceChunkIds.length === 0) return json({ cards: [], emptyReason: "insufficient_sources" });
  if (!allowGeneration(user.id)) {
    recordSafeOperation({ operation: "course_flashcards", provider: "unknown", outcome: "failure", durationMs: 0, failureCategory: "rate_limited" });
    return json({ error: "rate_limited" }, 429);
  }

  const { data: chunks, error: chunksError } = await supabase.from("material_chunks")
    .select("id,ordinal,page_start,page_end,content")
    .in("id", sourceChunkIds).eq("course_id", course.id).eq("material_id", material.id).eq("user_id", user.id)
    .order("ordinal", { ascending: true });
  if (chunksError || !chunks) {
    recordSafeOperation({ operation: "course_flashcards", provider: "unknown", outcome: "failure", durationMs: 0, failureCategory: "sources_unavailable" });
    return json({ error: "sources_unavailable" }, 503);
  }
  const usableChunks: typeof chunks = [];
  let remainingCharacters = 24_000;
  for (const chunk of chunks.slice(0, 12)) {
    if (remainingCharacters <= 0) break;
    const content = chunk.content.slice(0, remainingCharacters);
    if (!content.trim()) continue;
    usableChunks.push({ ...chunk, content });
    remainingCharacters -= content.length;
  }
  if (!usableChunks.length || usableChunks.every((chunk) => chunk.content.trim().length < 40)) {
    return json({ cards: [], emptyReason: "insufficient_sources" });
  }

  const providerStartedAt = Date.now();
  let providerName: ReturnType<typeof getServerConfig>["AI_PROVIDER"] | "unknown" = "unknown";
  let timeoutSignal: AbortSignal | null = null;
  try {
    providerName = getServerConfig().AI_PROVIDER;
    const provider = createGenerationProvider();
    const timeout = AbortSignal.timeout(generationTimeoutMs);
    timeoutSignal = timeout;
    const cards = await generateCourseFlashcards(provider, {
      conceptTitle: concept.title,
      conceptDescription: concept.description,
      evidence: usableChunks.map((chunk) => ({
        chunkId: chunk.id,
        pageStart: chunk.page_start,
        pageEnd: chunk.page_end,
        content: chunk.content,
      })),
      signal: AbortSignal.any([request.signal, timeout]),
      usageUserId: user.id,
    });
    recordSafeOperation({ operation: "course_flashcards", provider: providerName, outcome: "success", durationMs: Date.now() - providerStartedAt });
    if (!cards.length) return json({ cards: [], emptyReason: "no_supported_cards" });
    return json({
      cards: cards.map((card) => ({
        question: card.question,
        answer: card.answer,
        highlightTerms: card.highlightTerms,
      })),
    });
  } catch (error) {
    const timedOut = Boolean(timeoutSignal?.aborted && !request.signal.aborted);
    const cancelled = request.signal.aborted && !timedOut;
    const errorCode = timedOut ? "generation_timeout" : classifyCourseFlashcardGenerationError(error);
    recordSafeOperation({
      operation: "course_flashcards",
      provider: providerName,
      outcome: cancelled ? "cancelled" : "failure",
      durationMs: Date.now() - providerStartedAt,
      failureCategory: cancelled ? "cancelled" : telemetryCategory(errorCode),
    });
    const status = cancelled ? 503
      : errorCode === "generation_timeout" ? 504
        : errorCode === "usage_limit" || errorCode === "provider_quota" ? 429
          : errorCode === "provider_rejected" || errorCode === "invalid_generation" ? 502 : 503;
    return json({ error: cancelled ? "generation_unavailable" : errorCode }, status);
  }
}

export async function POST(request: Request) {
  try {
    return await postFlashcards(request);
  } catch {
    recordSafeOperation({ operation: "course_flashcards", provider: "unknown", outcome: "failure", durationMs: 0, failureCategory: "unexpected" });
    return json({ error: "unexpected_error" }, 500);
  }
}
