import Link from "next/link";
import { notFound } from "next/navigation";
import { startPracticeSessionAction } from "@/app/actions/practice";
import { createClient } from "@/lib/supabase/server";
import { getPracticeProblemsForTopic, getPracticeTopic } from "@/server/practice/catalog";

export default async function PracticeTopicPage({ params, searchParams }: {
  params: Promise<{ topicId: string }>;
  searchParams: Promise<{ conceptId?: string; error?: string }>;
}) {
  const [{ topicId }, query] = await Promise.all([params, searchParams]);
  const topic = getPracticeTopic(topicId);
  if (!topic) notFound();
  let conceptId = "";
  if (query.conceptId && /^[0-9a-f-]{36}$/i.test(query.conceptId)) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data, error } = await supabase.from("course_concepts").select("id").eq("id", query.conceptId).eq("user_id", user.id).maybeSingle();
      if (error) throw new Error("concept_lookup_failed");
      if (data) conceptId = data.id;
    }
  }
  const problems = getPracticeProblemsForTopic(topic.id);
  return <section className="simple-page practice-page">
    <Link className="back-link" href="/practice">← All topics</Link>
    <p className="eyebrow">PRACTICE TOPIC</p><h1>{topic.label}</h1><p className="intro-copy">{topic.description}</p>
    {query.error === "session" && <p className="form-error" role="alert">We couldn&apos;t save this practice session. Please try again.</p>}
    <ul className="practice-problem-list">{problems.map((problem) => <li className="practice-problem-card" key={problem.id}>
      <div><p className="eyebrow">{problem.difficulty} · LEETCODE #{problem.id}</p><h2>{problem.title}</h2><p className="practice-tags">{problem.tags.join(" · ")}</p></div>
      <form action={startPracticeSessionAction}>
        <input type="hidden" name="problemSlug" value={problem.slug} />
        <input type="hidden" name="topicId" value={topic.id} />
        {conceptId && <input type="hidden" name="sourceConceptId" value={conceptId} />}
        <button className="button button-primary" type="submit">Start or resume <span aria-hidden="true">→</span></button>
      </form>
    </li>)}</ul>
  </section>;
}
