import "server-only";
import { retrievedCourseChunkSchema, type RetrievedCourseChunk } from "@/contracts/grounded-learning";
import { createEmbeddingProvider } from "@/server/embeddings/create-provider";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
export type CourseEvidenceResult = {
  status: "supporting_evidence_found" | "no_sufficient_support";
  chunks: RetrievedCourseChunk[];
};

const maxEvidenceChunks = 8;
const minimumSemanticSimilarity = 0.42;

export class CourseRetrievalUnavailableError extends Error {
  constructor() {
    super("Course retrieval is unavailable");
    this.name = "CourseRetrievalUnavailableError";
  }
}

function sufficientSupport(chunks: RetrievedCourseChunk[]) {
  return chunks.some((chunk) => chunk.lexical_match
    || (chunk.semantic_similarity !== null && chunk.semantic_similarity >= minimumSemanticSimilarity));
}

export async function retrieveCourseEvidence(
  supabase: SupabaseServerClient,
  input: { courseId: string; materialId: string; conceptId: string; question: string; signal: AbortSignal },
): Promise<CourseEvidenceResult> {
  const provider = createEmbeddingProvider();
  let vectors: number[][];
  try {
    vectors = await provider.embed({ texts: [input.question], signal: input.signal, task: "query" });
  } catch {
    throw new CourseRetrievalUnavailableError();
  }
  if (vectors.length !== 1 || vectors[0].length !== 768 || vectors[0].some((item) => !Number.isFinite(item))) {
    throw new CourseRetrievalUnavailableError();
  }
  const vector = `[${vectors[0].join(",")}]`;
  const embeddingModel = provider.modelId;
  async function search(materialId: string | null): Promise<RetrievedCourseChunk[]> {
    const { data, error } = await supabase.rpc("search_course_material_chunks", {
      p_course_id: input.courseId,
      p_query_text: input.question,
      p_query_embedding: vector,
      p_embedding_model: embeddingModel,
      p_material_id: materialId,
      p_concept_id: input.conceptId,
      p_limit: maxEvidenceChunks,
    }).abortSignal(input.signal);
    if (error || !Array.isArray(data)) throw new CourseRetrievalUnavailableError();
    const parsed = data.map((row: unknown) => retrievedCourseChunkSchema.safeParse(row));
    if (parsed.some((result) => !result.success)) throw new CourseRetrievalUnavailableError();
    return parsed.flatMap((result) => result.success ? [result.data] : []);
  }

  try {
    const materialChunks = await search(input.materialId);
    let chunks = materialChunks;
    if (!sufficientSupport(materialChunks) || materialChunks.length < 3) {
      const courseChunks = await search(null);
      const merged = new Map<string, RetrievedCourseChunk>();
      for (const chunk of materialChunks) merged.set(chunk.chunk_id, chunk);
      for (const chunk of courseChunks) {
        const prior = merged.get(chunk.chunk_id);
        if (!prior || chunk.rank_score > prior.rank_score) merged.set(chunk.chunk_id, chunk);
      }
      chunks = [...merged.values()]
        .sort((a, b) => {
          const aScore = a.rank_score + (a.material_id === input.materialId ? 0.01 : 0);
          const bScore = b.rank_score + (b.material_id === input.materialId ? 0.01 : 0);
          return bScore - aScore;
        })
        .slice(0, maxEvidenceChunks);
    }
    const hasSupport = sufficientSupport(chunks);
    return { status: hasSupport ? "supporting_evidence_found" : "no_sufficient_support", chunks: hasSupport ? chunks : [] };
  } catch (error) {
    if (error instanceof CourseRetrievalUnavailableError) throw error;
    throw new CourseRetrievalUnavailableError();
  }
}
