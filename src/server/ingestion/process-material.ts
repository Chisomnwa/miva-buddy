import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { GenerationProvider } from "@/server/ai/provider";
import { MalformedProviderOutputError } from "@/server/ai/provider";
import type { EmbeddingProvider } from "@/server/embeddings/provider";
import { MalformedEmbeddingOutputError } from "@/server/embeddings/provider";
import { getServerConfig } from "@/lib/config";
import { MAX_MATERIAL_TEXT_CHARACTERS, MAX_PDF_BYTES, processMaterialJobSchema, type ProcessMaterialJob } from "@/contracts/course-material";
import { chunkMaterialPages } from "./chunking";
import { extractCourseConcepts } from "./concept-extraction";
import { extractPdfPages, PdfMaterialError } from "./pdf-extraction";
import type { PageText } from "./chunking";

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

type Dependencies = {
  pool: Pool;
  embeddings: EmbeddingProvider;
  generation: GenerationProvider;
  signal: AbortSignal;
};

export class TerminalMaterialProcessingError extends Error {
  constructor(readonly failureCode: string) {
    super("Course material could not be prepared");
    this.name = "TerminalMaterialProcessingError";
  }
}

async function loadPages(job: ProcessMaterialJob, dependencies: Dependencies) {
  if (job.kind === "notes") {
    const result = await dependencies.pool.query<{ page_number: number; content: string }>(
      `select page_number, content from public.material_pages
       where material_id = $1 and course_id = $2 and user_id = $3
       order by page_number asc`,
      [job.materialId, job.courseId, job.userId],
    );
    return result.rows.map((row) => ({ pageNumber: row.page_number, content: row.content }));
  }

  const config = getServerConfig();
  if (!isTrustedCourseMaterialSignedUrl(job.signedUrl, config.NEXT_PUBLIC_SUPABASE_URL, job)) {
    throw new TerminalMaterialProcessingError("invalid_storage_reference");
  }
  const signedUrl = new URL(job.signedUrl);

  const response = await fetch(signedUrl, {
    signal: dependencies.signal,
    headers: { accept: "application/pdf, application/octet-stream" },
  });
  if (!response.ok) throw new Error("Private course file could not be fetched");
  const advertisedLength = Number(response.headers.get("content-length") ?? 0);
  if (advertisedLength > MAX_PDF_BYTES) throw new PdfMaterialError("file_too_large");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_PDF_BYTES) throw new PdfMaterialError("file_too_large");
  return extractPdfPages(bytes);
}

export function isTrustedCourseMaterialSignedUrl(
  rawSignedUrl: string,
  rawProjectUrl: string,
  job: Pick<ProcessMaterialJob, "userId" | "courseId" | "materialId">,
): boolean {
  try {
    const signedUrl = new URL(rawSignedUrl);
    const projectUrl = new URL(rawProjectUrl);
    const localHttp = projectUrl.protocol === "http:"
      && signedUrl.protocol === "http:"
      && loopbackHosts.has(projectUrl.hostname.toLowerCase())
      && loopbackHosts.has(signedUrl.hostname.toLowerCase());
    const secureRemote = projectUrl.protocol === "https:" && signedUrl.protocol === "https:";
    const expectedPrefix = `/storage/v1/object/sign/course-materials/${job.userId}/${job.courseId}/${job.materialId}/`;

    return (localHttp || secureRemote)
      && signedUrl.origin === projectUrl.origin
      && decodeURIComponent(signedUrl.pathname).startsWith(expectedPrefix);
  } catch {
    return false;
  }
}

async function embedInBatches(dependencies: Dependencies, texts: string[]) {
  const allVectors: number[][] = [];
  for (let index = 0; index < texts.length; index += 24) {
    const batch = await dependencies.embeddings.embed({
      texts: texts.slice(index, index + 24),
      signal: dependencies.signal,
      task: "document",
    });
    allVectors.push(...batch);
  }
  if (allVectors.length !== texts.length || allVectors.some((vector) => vector.length !== 768)) {
    throw new MalformedEmbeddingOutputError();
  }
  return allVectors;
}

async function setMaterialFailure(pool: Pool, job: ProcessMaterialJob, code: string) {
  await pool.query(
    `update public.course_materials
     set status = 'failed', failure_code = $4, updated_at = now()
     where id = $1 and user_id = $2 and course_id = $3`,
    [job.materialId, job.userId, job.courseId, code],
  );
}

export async function processCourseMaterial(rawJob: unknown, dependencies: Dependencies): Promise<void> {
  const job = processMaterialJobSchema.parse(rawJob);
  const material = await dependencies.pool.query<{ kind: string; status: string }>(
    `select kind, status from public.course_materials
     where id = $1 and user_id = $2 and course_id = $3`,
    [job.materialId, job.userId, job.courseId],
  );
  if (!material.rowCount || material.rows[0].kind !== job.kind) return;

  await dependencies.pool.query(
    `update public.course_materials
     set status = 'processing', failure_code = null,
         processing_attempts = processing_attempts + 1, updated_at = now()
     where id = $1 and user_id = $2 and course_id = $3`,
    [job.materialId, job.userId, job.courseId],
  );

  let pages: PageText[];
  try {
    pages = await loadPages(job, dependencies);
    const totalCharacters = pages.reduce((sum, page) => sum + page.content.length, 0);
    if (totalCharacters === 0) throw new PdfMaterialError("no_extractable_text");
    if (totalCharacters > MAX_MATERIAL_TEXT_CHARACTERS) throw new PdfMaterialError("text_too_large");
  } catch (error) {
    if (error instanceof PdfMaterialError) {
      const code = error.code === "no_extractable_text" ? "no_extractable_text" : error.code;
      await setMaterialFailure(dependencies.pool, job, code);
      return;
    }
    if (error instanceof TerminalMaterialProcessingError) {
      await setMaterialFailure(dependencies.pool, job, error.failureCode);
      return;
    }
    throw error;
  }

  const chunks = chunkMaterialPages(pages).map((chunk) => ({ ...chunk, id: randomUUID() }));
  if (!chunks.length) {
    await setMaterialFailure(dependencies.pool, job, "no_extractable_text");
    return;
  }

  const vectors = await embedInBatches(dependencies, chunks.map((chunk) => chunk.content));
  const extracted = await extractCourseConcepts(
    dependencies.generation,
    chunks.map(({ id, ordinal, pageStart, pageEnd, content }) => ({ id, ordinal, pageStart, pageEnd, content })),
    dependencies.signal,
  );
  const embeddingModel = dependencies.embeddings.modelId;
  const client = await dependencies.pool.connect();
  try {
    await client.query("begin");
    await client.query(
      "delete from public.course_concepts where material_id = $1 and user_id = $2 and course_id = $3",
      [job.materialId, job.userId, job.courseId],
    );
    await client.query(
      "delete from public.material_chunks where material_id = $1 and user_id = $2 and course_id = $3",
      [job.materialId, job.userId, job.courseId],
    );
    await client.query(
      "delete from public.material_pages where material_id = $1 and user_id = $2 and course_id = $3",
      [job.materialId, job.userId, job.courseId],
    );
    for (const page of pages) {
      await client.query(
        `insert into public.material_pages (user_id, course_id, material_id, page_number, content)
         values ($1, $2, $3, $4, $5)`,
        [job.userId, job.courseId, job.materialId, page.pageNumber, page.content],
      );
    }
    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      const vector = `[${vectors[index].join(",")}]`;
      await client.query(
        `insert into public.material_chunks
          (id, user_id, course_id, material_id, ordinal, page_start, page_end, content, embedding, embedding_model)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9::extensions.vector, $10)`,
        [chunk.id, job.userId, job.courseId, job.materialId, chunk.ordinal, chunk.pageStart, chunk.pageEnd, chunk.content, vector, embeddingModel],
      );
    }
    for (const [ordinal, concept] of extracted.concepts.entries()) {
      const conceptId = randomUUID();
      await client.query(
        `insert into public.course_concepts
          (id, user_id, course_id, material_id, title, description, ordinal, extraction_version)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [conceptId, job.userId, job.courseId, job.materialId, concept.title, concept.description, ordinal, "concepts-v1"],
      );
      for (const chunkId of concept.supportingChunkIds) {
        await client.query(
          `insert into public.course_concept_sources (user_id, material_id, concept_id, chunk_id)
           values ($1, $2, $3, $4)`,
          [job.userId, job.materialId, conceptId, chunkId],
        );
      }
    }
    await client.query(
      `update public.course_materials
       set status = 'ready', failure_code = null, updated_at = now()
       where id = $1 and user_id = $2 and course_id = $3`,
      [job.materialId, job.userId, job.courseId],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function markTerminalFailure(pool: Pool, job: ProcessMaterialJob, error: unknown) {
  if (error instanceof PdfMaterialError) {
    await setMaterialFailure(pool, job, error.code);
    return true;
  }
  if (error instanceof TerminalMaterialProcessingError) {
    await setMaterialFailure(pool, job, error.failureCode);
    return true;
  }
  if (error instanceof MalformedProviderOutputError || error instanceof MalformedEmbeddingOutputError) {
    await setMaterialFailure(pool, job, "structured_processing_failed");
    return true;
  }
  return false;
}
