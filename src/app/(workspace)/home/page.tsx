import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { getRecentLearnConversations } from "@/lib/learning";
import { RecentLearning } from "@/components/recent-learning";
import { getPracticeProblem, getPracticeTopic } from "@/server/practice/catalog";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile, error: profileError } = user ? await getProfile(user.id) : { data: null, error: null };
  if (profileError) throw new Error("profile_lookup_failed");
  const recent = user ? await getRecentLearnConversations(user.id, 3) : [];
  const { data: practiceSessions, error: practiceError } = user ? await supabase.from("practice_sessions")
    .select("id,problem_slug,topic_id,mode,updated_at").eq("user_id", user.id).eq("status", "in_progress")
    .order("updated_at", { ascending: false }).limit(3) : { data: [], error: null };
  if (practiceError) throw new Error("practice_resume_lookup_failed");
  const firstName = profile?.programme ? (user?.user_metadata?.name as string | undefined)?.split(" ")[0] : undefined;

  return (
    <>
      <section className="welcome-block">
        <p className="eyebrow">YOUR LEARNING COMPANION</p>
        <h1>{firstName ? `Good to see you, ${firstName}.` : "What would you like to learn today?"}</h1>
        <p className="intro-copy">A steady place to understand your coursework and practise what matters.</p>
        <Link className="button button-primary" href="/learn">Start learning <span aria-hidden="true">→</span></Link>
      </section>
      <section className="home-grid" aria-label="Ways to get started">
        <article className="start-card">
          <span className="card-symbol" aria-hidden="true">01</span>
          <p className="eyebrow">LEARN FROM YOUR COURSES</p>
          <h2>Bring your course material</h2>
          <p>Add a course and learn from your notes, with clear references back to the source.</p>
          <Link className="text-link" href="/courses">Add course materials <span aria-hidden="true">→</span></Link>
        </article>
        <article className="start-card">
          <span className="card-symbol card-symbol-red" aria-hidden="true">02</span>
          <p className="eyebrow">PRACTISE DSA</p>
          <h2>Build problem-solving confidence</h2>
          <p>Choose a curated problem and get help in the mode that feels right for you.</p>
          <Link className="text-link" href="/practice">Explore Practice <span aria-hidden="true">→</span></Link>
        </article>
      </section>
      {practiceSessions && practiceSessions.length > 0 && <section className="recent-learning" aria-labelledby="recent-practice-heading">
        <div className="section-heading-row"><h2 id="recent-practice-heading">Continue Practice</h2><Link className="text-link" href="/practice">All topics</Link></div>
        <ul className="recent-learning-list">{practiceSessions.map((session) => {
          const problem = getPracticeProblem(session.problem_slug);
          const topic = getPracticeTopic(session.topic_id);
          return problem ? <li key={session.id}><Link href={`/practice/session/${session.id}`}><span>{problem.title}<small className="practice-list-meta">{topic?.label ?? "Practice"} · {session.mode === "coach" ? "Coach" : session.mode === "tutor" ? "Tutor" : "Hands Off"}</small></span><span aria-hidden="true">→</span></Link></li> : null;
        })}</ul>
      </section>}
      <RecentLearning conversations={recent} />
      <p className="home-footnote">{profile?.programme ? `${profile.programme} · ${profile.level}` : "Your learning progress will appear here as you go."}</p>
    </>
  );
}
