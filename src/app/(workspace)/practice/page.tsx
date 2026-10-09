import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PRACTICE_TOPICS, getPracticeProblem, getPracticeProblemsForTopic } from "@/server/practice/catalog";

export default async function PracticePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: sessions, error } = user ? await supabase.from("practice_sessions")
    .select("id,problem_slug,topic_id,mode,status,updated_at")
    .eq("user_id", user.id).eq("status", "in_progress").order("updated_at", { ascending: false }).limit(8) : { data: [], error: null };
  if (error) throw new Error("practice_resume_lookup_failed");
  return <section className="simple-page practice-page">
    <p className="eyebrow">PRACTICE · DATA STRUCTURES & ALGORITHMS</p>
    <h1>Choose a path to practise</h1>
    <p className="intro-copy">Explore curated problems across 14 DSA patterns, from first steps to more challenging techniques. Solve on LeetCode and return here for guided practice.</p>
    {sessions && sessions.length > 0 && <section className="practice-resume" aria-labelledby="resume-heading">
      <h2 id="resume-heading">Continue where you left off</h2>
      <ul className="recent-learning-list">{sessions.map((session) => {
        const problem = getPracticeProblem(session.problem_slug);
        return problem ? <li key={session.id}><Link href={`/practice/session/${session.id}`}>
          <span>{problem.title}<small className="practice-list-meta">{problem.difficulty} · {session.mode === "coach" ? "Coach" : session.mode === "tutor" ? "Tutor" : "Hands Off"}</small></span><span aria-hidden="true">→</span>
        </Link></li> : null;
      })}</ul>
    </section>}
    <section className="practice-topic-grid" aria-label="DSA topics">
      {PRACTICE_TOPICS.map((topic) => <article className="practice-topic-card" key={topic.id}>
        <p className="eyebrow">DSA PATTERN</p><h2>{topic.label}</h2><p>{topic.description}</p>
        <p className="practice-topic-count">{getPracticeProblemsForTopic(topic.id).length} curated problems</p>
        <Link className="text-link" href={`/practice/topic/${topic.id}`}>Browse problems <span aria-hidden="true">→</span></Link>
      </article>)}
    </section>
  </section>;
}
