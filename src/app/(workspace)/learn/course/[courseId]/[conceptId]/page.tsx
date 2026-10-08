import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GroundedLearnExperience } from "@/components/grounded-learn-experience";
import type { GroundedStoredMessage } from "@/components/grounded-learn-conversation";
import { mapConceptToPracticeTopic } from "@/server/practice/concept-mapping";

type PageProps = {
  params: Promise<{ courseId: string; conceptId: string }>;
  searchParams: Promise<{ conversationId?: string; notice?: string }>;
};

export default async function GroundedLearnPage({ params, searchParams }: PageProps) {
  const [{ courseId, conceptId }, query] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data: course, error: courseError } = await supabase.from("courses").select("id,title")
    .eq("id", courseId).eq("user_id", user.id).maybeSingle();
  if (courseError) throw new Error("course_lookup_failed");
  if (!course) notFound();
  const { data: concept, error: conceptError } = await supabase.from("course_concepts")
    .select("id,title,description,material_id,course_id")
    .eq("id", conceptId).eq("course_id", course.id).eq("user_id", user.id).maybeSingle();
  if (conceptError) throw new Error("concept_lookup_failed");
  if (!concept) notFound();
  const { data: material, error: materialError } = await supabase.from("course_materials")
    .select("id,title,status").eq("id", concept.material_id).eq("course_id", course.id).eq("user_id", user.id).maybeSingle();
  if (materialError) throw new Error("material_lookup_failed");
  if (!material || material.status !== "ready") notFound();

  let conversationId: string | undefined;
  let messages: GroundedStoredMessage[] = [];
  if (query.conversationId) {
    const { data: conversation, error: conversationError } = await supabase.from("learn_conversations")
      .select("id,course_id,material_id,concept_id,title")
      .eq("id", query.conversationId).eq("user_id", user.id).maybeSingle();
    if (conversationError) throw new Error("grounded_conversation_lookup_failed");
    if (!conversation || conversation.course_id !== course.id || conversation.material_id !== material.id
      || conversation.concept_id !== concept.id) notFound();
    conversationId = conversation.id;
    const { data: storedMessages, error } = await supabase.from("learn_messages")
      .select("id,role,content,response_segments,follow_up_questions,grounding_status")
      .eq("conversation_id", conversation.id).eq("user_id", user.id)
      .order("created_at", { ascending: true }).order("id", { ascending: true });
    if (error) throw new Error("grounded_messages_lookup_failed");
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
  const practiceTopic = mapConceptToPracticeTopic(concept.title);

  return <section className="learn-page grounded-learn-page">
    <Link className="back-link" href={`/courses/${course.id}`}>← {course.title}</Link>
    <p className="eyebrow">GROUNDED LEARNING · {material.title.toLocaleUpperCase("en-US")}</p>
    <h1>{concept.title}</h1>
    <p className="intro-copy">{concept.description}</p>
    {practiceTopic && <p className="concept-practice-link"><Link className="text-link" href={`/practice/topic/${practiceTopic}?conceptId=${concept.id}`}>Practise this DSA topic <span aria-hidden="true">→</span></Link></p>}
    <div className="general-learning-label grounded-learning-label">
      <span className="general-learning-dot" aria-hidden="true" />
      <div><strong>Learning from your course material</strong><p>Source references are tied to passages from {material.title}.</p></div>
    </div>
    {query.notice === "retry" && <p className="form-error" role="status">We couldn&apos;t retrieve your course material or prepare a reply just now. Your question is saved; you can try again below.</p>}
    <div className="learning-disclosure" role="note">Your question and up to six recent messages, plus only relevant passages from this course, may be sent to the configured AI provider.</div>
    <GroundedLearnExperience messages={messages} courseId={course.id} materialId={material.id} conceptId={concept.id}
      conversationId={conversationId} suggestions={lastAssistant?.follow_up_questions ?? []} />
  </section>;
}
