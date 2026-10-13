import Link from "next/link";
import { notFound } from "next/navigation";
import { MaterialForms } from "@/components/course-forms";
import { CourseProcessingRefresh } from "@/components/course-processing-refresh";
import { CourseConceptSelector, orderConceptsByMaterial } from "@/components/course-concept-navigation";
import { GroundedConceptLearningModes } from "@/components/grounded-concept-learning-modes";
import { getPermanentUser } from "@/lib/auth/permanent-user";
import { displayCourseTitle } from "@/lib/course-title-display";
import { courseFlashcardSourceVersion } from "@/lib/course-flashcard-source-version";
import type { GroundedStoredMessage } from "@/components/grounded-learn-conversation";
import { mapConceptToPracticeTopic } from "@/server/practice/concept-mapping";

type CoursePageProps = {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ conceptId?: string | string[]; conversationId?: string | string[]; notice?: string | string[] }>;
};

export default async function CourseDetailPage({ params, searchParams }: CoursePageProps) {
  const [{ courseId }, query] = await Promise.all([params, searchParams]);
  if (Array.isArray(query.conceptId) || Array.isArray(query.conversationId) || Array.isArray(query.notice)) notFound();
  const requestedConceptId = query.conceptId;
  const requestedConversationId = query.conversationId;
  const { supabase, user } = await getPermanentUser();
  if (!user) notFound();
  const { data: course, error: courseError } = await supabase.from("courses").select("id,title,course_code").eq("id", courseId).eq("user_id", user.id).maybeSingle();
  if (courseError) throw new Error("course_lookup_failed");
  if (!course) notFound();
  const { data: materials, error: materialsError } = await supabase.from("course_materials")
    .select("id,title,status,created_at,updated_at")
    .eq("course_id", course.id).eq("user_id", user.id).order("created_at", { ascending: false });
  if (materialsError) throw new Error("course_materials_lookup_failed");
  const materialIds = (materials ?? []).map((material) => material.id);
  const { data: concepts, error: conceptsError } = materialIds.length
    ? await supabase.from("course_concepts").select("id,course_id,material_id,title,description,ordinal,extraction_version").in("material_id", materialIds)
      .eq("course_id", course.id).eq("user_id", user.id).order("ordinal").order("id")
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
  const provenanceByConcept = new Map<string, Set<string>>();
  for (const source of sources ?? []) {
    const label = pageByChunk.get(source.chunk_id);
    if (label) {
      const labels = provenanceByConcept.get(source.concept_id) ?? new Set<string>();
      labels.add(label);
      provenanceByConcept.set(source.concept_id, labels);
    }
  }

  const readyMaterials = (materials ?? []).filter((material) => material.status === "ready")
    .sort((left, right) => left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id));
  const orderedConcepts = orderConceptsByMaterial(readyMaterials, concepts ?? []);
  const selectedConcept = requestedConceptId
    ? orderedConcepts.find((concept) => concept.id === requestedConceptId)
    : orderedConcepts[0];
  if (requestedConceptId && !selectedConcept) notFound();
  const selectedMaterial = selectedConcept
    ? readyMaterials.find((material) => material.id === selectedConcept.material_id)
    : undefined;
  if (selectedConcept && !selectedMaterial) notFound();
  const selectedSourceChunkIds = selectedConcept
    ? (sources ?? []).filter((source) => source.concept_id === selectedConcept.id).map((source) => source.chunk_id)
    : [];
  const sourceVersion = selectedConcept && selectedMaterial
    ? courseFlashcardSourceVersion({
      materialUpdatedAt: selectedMaterial.updated_at,
      extractionVersion: selectedConcept.extraction_version,
      sourceChunkIds: selectedSourceChunkIds,
    })
    : "";

  let conversationId: string | undefined;
  let messages: GroundedStoredMessage[] = [];
  if (requestedConversationId) {
    if (!selectedConcept || !selectedMaterial) notFound();
    const { data: conversation, error: conversationError } = await supabase.from("learn_conversations")
      .select("id,course_id,material_id,concept_id,title")
      .eq("id", requestedConversationId).eq("user_id", user.id).maybeSingle();
    if (conversationError) throw new Error("grounded_conversation_lookup_failed");
    if (!conversation || conversation.course_id !== course.id || conversation.material_id !== selectedMaterial.id
      || conversation.concept_id !== selectedConcept.id) notFound();
    conversationId = conversation.id;
    const { data: storedMessages, error: messagesError } = await supabase.from("learn_messages")
      .select("id,role,content,response_segments,follow_up_questions,grounding_status")
      .eq("conversation_id", conversation.id).eq("user_id", user.id)
      .order("created_at", { ascending: true }).order("id", { ascending: true });
    if (messagesError) throw new Error("grounded_messages_lookup_failed");
    if (!storedMessages) notFound();
    messages = storedMessages.map((message) => ({
      id: message.id,
      role: message.role as "user" | "assistant",
      content: message.content,
      response_segments: message.response_segments,
      follow_up_questions: Array.isArray(message.follow_up_questions) ? message.follow_up_questions : [],
      grounding_status: message.grounding_status,
    }));
  }
  const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  const practiceTopic = selectedConcept ? mapConceptToPracticeTopic(selectedConcept.title) : null;
  const hasPendingMaterials = (materials ?? []).some((material) => material.status === "queued" || material.status === "processing");

  return <div className="course-workspace-page">
    <Link className="back-link warm-brand-link" href="/courses">← All courses</Link>
    <h1 className="course-workspace-title">{displayCourseTitle(course.title)}{course.course_code && <span> - {course.course_code}</span>}</h1>
    {selectedConcept && selectedMaterial ? <div className="course-learning-workspace">
      <main className="course-learning-main" aria-label="Course concept learning">
        <p className="eyebrow warm-brand-eyebrow">LEARNING FROM {selectedMaterial.title.toLocaleUpperCase("en-US")}</p>
        <h2 className="course-learning-title">{selectedConcept.title}</h2>
        <p className="intro-copy course-learning-description">{selectedConcept.description}</p>
        {[...(provenanceByConcept.get(selectedConcept.id) ?? [])].length > 0
          && <p className="source-label course-learning-source">Source: {[...(provenanceByConcept.get(selectedConcept.id) ?? [])].join(", ")}</p>}
        {practiceTopic && <p className="concept-practice-link"><Link className="text-link" href={`/practice/topic/${practiceTopic}?conceptId=${selectedConcept.id}`}>Practise this DSA topic <span aria-hidden="true">→</span></Link></p>}
        <div className="general-learning-label grounded-learning-label">
          <span className="general-learning-dot" aria-hidden="true" />
          <div><strong>Learning from your course material.</strong> Source references are tied to passages from {selectedMaterial.title}.</div>
        </div>
        {query.notice === "retry" && <p className="form-error" role="status">We couldn&apos;t retrieve your course material or prepare a reply just now. Your question is saved; you can try again below.</p>}
        <GroundedConceptLearningModes key={selectedConcept.id} conceptTitle={selectedConcept.title} messages={messages} courseId={course.id}
          userId={user.id} materialId={selectedMaterial.id} conceptId={selectedConcept.id} sourceVersion={sourceVersion} conversationId={conversationId}
          suggestions={lastAssistant?.follow_up_questions ?? []} />
      </main>
      <aside className="course-learning-sidebar" aria-label="Course concept navigation">
        <CourseConceptSelector courseId={course.id} concepts={orderedConcepts} currentConceptId={selectedConcept.id} />
      </aside>
    </div> : <section className="course-learning-empty" aria-label="Course learning workspace">
      <p className="eyebrow warm-brand-eyebrow">READY TO LEARN FROM</p>
      <h2>Materials and concepts</h2>
      <p>{materials?.length ? "Once a course material is ready, its extracted concepts will appear here." : "Add a PDF or paste your notes below to start learning from this course."}</p>
    </section>}
    <CourseProcessingRefresh pending={hasPendingMaterials} />
    <section className="course-material-management" aria-label="Add material to course">
      <div className="section-heading-row add-material-heading"><div><p className="eyebrow warm-brand-eyebrow">GROW THIS COURSE</p><h2>Add material</h2></div></div>
      <MaterialForms courseId={course.id} />
    </section>
  </div>;
}
