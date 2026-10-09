import Link from "next/link";
import { notFound } from "next/navigation";
import { MaterialForms } from "@/components/course-forms";
import { RetryMaterialForm } from "@/components/course-forms";
import { CourseProcessingRefresh } from "@/components/course-processing-refresh";
import { createClient } from "@/lib/supabase/server";
import { displayCourseTitle } from "@/lib/course-title-display";

const failureMessages: Record<string, string> = {
  no_extractable_text: "No readable text was found. Try a text-based PDF or paste the notes instead.",
  image_only_pdf: "This PDF contains pages without readable text. Paste the relevant text to continue.",
  file_too_large: "This PDF is larger than the supported limit.",
  too_many_pages: "This PDF has more pages than the supported limit.",
  text_too_large: "This file contains more text than can be processed at once.",
  unreadable_pdf: "This file could not be read as a PDF. Try another copy or paste the notes.",
  structured_processing_failed: "We couldn't reliably identify concepts in this material. Please try again later or paste the notes.",
};

function statusLabel(status: string) {
  return status === "queued" ? "Waiting to process" : status === "processing" ? "Reading material" : status === "ready" ? "Ready" : "Needs attention";
}

export default async function CourseDetailPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data: course, error: courseError } = await supabase.from("courses").select("id,title,course_code").eq("id", courseId).eq("user_id", user.id).maybeSingle();
  if (courseError) throw new Error("course_lookup_failed");
  if (!course) notFound();
  const { data: materials, error: materialsError } = await supabase.from("course_materials")
    .select("id,title,kind,status,failure_code,created_at")
    .eq("course_id", course.id).eq("user_id", user.id).order("created_at", { ascending: false });
  if (materialsError) throw new Error("course_materials_lookup_failed");
  const materialIds = (materials ?? []).map((material) => material.id);
  const { data: concepts, error: conceptsError } = materialIds.length
    ? await supabase.from("course_concepts").select("id,material_id,title,description,ordinal").in("material_id", materialIds).eq("user_id", user.id).order("ordinal")
    : { data: [], error: null };
  if (conceptsError) throw new Error("course_concepts_lookup_failed");
  const conceptIds = (concepts ?? []).map((concept) => concept.id);
  const { data: sources, error: sourcesError } = conceptIds.length
    ? await supabase.from("course_concept_sources").select("concept_id,chunk_id").in("concept_id", conceptIds).eq("user_id", user.id)
    : { data: [], error: null };
  if (sourcesError) throw new Error("concept_source_lookup_failed");
  const chunkIds = [...new Set((sources ?? []).map((source) => source.chunk_id))];
  const { data: chunks, error: chunksError } = chunkIds.length
    ? await supabase.from("material_chunks").select("id,page_start,page_end").in("id", chunkIds).eq("user_id", user.id)
    : { data: [], error: null };
  if (chunksError) throw new Error("concept_provenance_lookup_failed");
  const pageByChunk = new Map((chunks ?? []).map((chunk) => [chunk.id, `${chunk.page_start === chunk.page_end ? `p. ${chunk.page_start}` : `pp. ${chunk.page_start}–${chunk.page_end}`}`]));
  const provenanceByConcept = new Map<string, string[]>();
  for (const source of sources ?? []) {
    const label = pageByChunk.get(source.chunk_id);
    if (label) provenanceByConcept.set(source.concept_id, [...(provenanceByConcept.get(source.concept_id) ?? []), label]);
  }
  const conceptsByMaterial = new Map<string, typeof concepts>();
  for (const concept of concepts ?? []) conceptsByMaterial.set(concept.material_id, [...(conceptsByMaterial.get(concept.material_id) ?? []), concept]);
  const hasPendingMaterials = (materials ?? []).some((material) => material.status === "queued" || material.status === "processing");

  return <div className="simple-page">
    <Link className="back-link" href="/courses">← All courses</Link>
    <p className="eyebrow">{course.course_code || "COURSE"}</p><h1>{displayCourseTitle(course.title)}</h1>
    <p className="intro-copy">Add a PDF or paste your notes. Concepts are identified from the material and linked to their source pages.</p>
    {materials?.length ? <section className="materials-list" aria-label="Course materials"><div className="section-heading-row"><div><p className="eyebrow">READY TO LEARN FROM</p><h2>Materials and concepts</h2></div><span className="section-count">{materials.length} {materials.length === 1 ? "material" : "materials"}</span></div>
      {materials.map((material) => <article className="material-card" key={material.id}>
        <div className="material-heading"><div><p className="eyebrow">{material.kind === "pdf" ? "PDF" : "PASTED NOTES"}</p><h3>{material.title}</h3></div><span className={`status-pill status-${material.status}`}>{statusLabel(material.status)}</span></div>
        {material.status === "failed" && <><p className="material-error" role="status">{failureMessages[material.failure_code ?? ""] ?? "We couldn't process this material. Your original material is saved; you can add it again or paste its text."}</p>
          {(material.failure_code === "queue_unavailable" || material.failure_code === "processing_failed"
            || material.failure_code === "structured_processing_failed") && <RetryMaterialForm courseId={course.id} materialId={material.id} />}
        </>}
        {(conceptsByMaterial.get(material.id) ?? []).length > 0 && <ul className="concept-list">{(conceptsByMaterial.get(material.id) ?? []).map((concept) => <li className="concept-card" key={concept.id}>
          <h4>{concept.title}</h4><p>{concept.description}</p><p className="source-label">Source: { [...new Set(provenanceByConcept.get(concept.id) ?? [])].join(", ") || "course material" }</p>
          <Link className="text-link concept-learn-link" href={`/learn/course/${course.id}/${concept.id}`}>Learn this concept <span aria-hidden="true">→</span></Link>
        </li>)}</ul>}
      </article>)}
    </section> : <p className="empty-state">No materials yet. Add a PDF or paste your notes below.</p>}
    <CourseProcessingRefresh pending={hasPendingMaterials} />
    <div className="section-heading-row add-material-heading"><div><p className="eyebrow">GROW THIS COURSE</p><h2>Add material</h2></div></div>
    <MaterialForms courseId={course.id} />
  </div>;
}
