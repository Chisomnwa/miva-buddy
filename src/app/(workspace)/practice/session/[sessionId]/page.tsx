import Link from "next/link";
import { notFound } from "next/navigation";
import { completePracticeSessionAction } from "@/app/actions/practice";
import { PracticeCoach } from "@/components/practice-coach";
import { getPermanentUser } from "@/lib/auth/permanent-user";
import { getNextPracticeProblem, getPracticeProblem, getPracticeTopic } from "@/server/practice/catalog";
import { startPracticeSessionAction } from "@/app/actions/practice";

export default async function PracticeSessionPage({ params, searchParams }: { params: Promise<{ sessionId: string }>; searchParams: Promise<{ notice?: string }> }) {
  const [{ sessionId }, query] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) notFound();
  const { supabase, user } = await getPermanentUser();
  if (!user) notFound();
  const { data: session, error: sessionError } = await supabase.from("practice_sessions")
    .select("id,problem_id,problem_slug,topic_id,mode,status,source_concept_id")
    .eq("id", sessionId).eq("user_id", user.id).maybeSingle();
  if (sessionError) throw new Error("practice_session_lookup_failed");
  if (!session) notFound();
  const problem = getPracticeProblem(session.problem_slug);
  const topic = getPracticeTopic(session.topic_id);
  if (!problem || !topic || problem.id !== session.problem_id) notFound();
  const nextProblem = session.status === "completed" ? getNextPracticeProblem(topic.id, problem.id) : null;
  const { data: messageRows, error: messagesError } = await supabase.from("practice_messages")
    .select("id,role,content,attempt,response_payload").eq("session_id", session.id).eq("user_id", user.id)
    .order("created_at", { ascending: true }).limit(80);
  if (messagesError) throw new Error("practice_messages_lookup_failed");
  return <section className="simple-page practice-page">
    <Link className="back-link" href={`/practice/topic/${topic.id}`}>← {topic.label}</Link>
    <p className="eyebrow">PRACTICE SESSION · {problem.difficulty}</p>
    <h1>{problem.title}</h1>
    <p className="intro-copy">Solve the problem on LeetCode, then return here if you want to reflect or continue.</p>
    <div className="practice-session-actions">
      <a className="button button-primary" href={problem.url} target="_blank" rel="noopener noreferrer">Open original problem on LeetCode <span aria-hidden="true">↗</span></a>
      <p className="learning-disclosure">Miva Buddy does not observe submissions or verify whether LeetCode accepted a solution.</p>
    </div>
    {session.status === "in_progress" ? <>
      {query.notice === "completion_failed" && <p className="form-error" role="alert">We couldn’t update this practice session. Please try again.</p>}
      <PracticeCoach sessionId={session.id} initialMode={session.mode as "hands_off" | "coach" | "tutor"}
        initialMessages={(messageRows ?? []).map((row) => ({ id: row.id, role: row.role as "user" | "assistant", content: row.content, attempt: row.attempt, response: row.response_payload as import("@/contracts/practice-coaching").PracticeCoachResponse | null }))} />
      <form action={completePracticeSessionAction.bind(null, session.id)}>
        <button className="button button-secondary" type="submit">Mark complete</button>
        <p className="learning-disclosure">Completion is your own check-in, not verified acceptance.</p>
      </form>
    </> : <>
      {messageRows && messageRows.length > 0 && <PracticeCoach sessionId={session.id} initialMode={session.mode as "hands_off" | "coach" | "tutor"} readOnly
        initialMessages={messageRows.map((row) => ({ id: row.id, role: row.role as "user" | "assistant", content: row.content, attempt: row.attempt, response: row.response_payload as import("@/contracts/practice-coaching").PracticeCoachResponse | null }))} />}
      <div className="general-learning-label"><div><strong>Marked complete</strong><p>This is your manual status; LeetCode acceptance was not checked.</p></div></div>
      {nextProblem ? <form action={startPracticeSessionAction}>
        <input type="hidden" name="problemSlug" value={nextProblem.slug} />
        <input type="hidden" name="topicId" value={topic.id} />
        {session.source_concept_id && <input type="hidden" name="sourceConceptId" value={session.source_concept_id} />}
        <button className="button button-primary" type="submit">Next {topic.label} problem: {nextProblem.title} <span aria-hidden="true">→</span></button>
      </form> : <Link className="button button-primary" href={`/practice/topic/${topic.id}`}>Choose another problem <span aria-hidden="true">→</span></Link>}
      <p><Link className="text-link" href={`/practice/topic/${topic.id}`}>Back to {topic.label}</Link></p>
    </>}
  </section>;
}
