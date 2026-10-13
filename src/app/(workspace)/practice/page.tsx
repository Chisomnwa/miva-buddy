import { getPermanentUser } from "@/lib/auth/permanent-user";
import { PracticePatternList } from "@/components/practice-pattern-list";
import { PracticeResumeSection } from "@/components/practice-resume-section";
import { PRACTICE_CATALOG, getPracticeProblem } from "@/server/practice/catalog";

export default async function PracticePage() {
  const { supabase, user } = await getPermanentUser();
  const { data: sessions, error } = user ? await supabase.from("practice_sessions")
    .select("id,problem_slug,topic_id,mode,status,updated_at")
    .eq("user_id", user.id).in("problem_slug", PRACTICE_CATALOG.map((problem) => problem.slug))
    .order("updated_at", { ascending: false }) : { data: [], error: null };
  const progressAvailable = Boolean(user && !error);
  const availableSessions = progressAvailable ? sessions ?? [] : [];
  const resumableSessions = availableSessions.filter((session) => session.status === "in_progress").flatMap((session) => {
    const problem = getPracticeProblem(session.problem_slug);
    return problem ? [{ id: session.id, title: problem.title, difficulty: problem.difficulty, mode: session.mode }] : [];
  });
  return <section className="simple-page practice-page">
    <p className="eyebrow warm-brand-eyebrow">PRACTICE · DATA STRUCTURES & ALGORITHMS</p>
    <h1>Choose a path to practise</h1>
    <p className="intro-copy">Explore curated problems across 14 DSA patterns, from first steps to more challenging techniques. Solve on LeetCode and return here for guided practice.</p>
    <PracticeResumeSection items={resumableSessions} />
    {!progressAvailable && <p className="practice-progress-unavailable" role="status">Your saved progress is temporarily unavailable. You can still browse and start a problem.</p>}
    <p className="practice-completion-disclosure">Completion is your own check-in; Miva Buddy does not verify LeetCode submissions.</p>
    <PracticePatternList sessions={availableSessions} progressAvailable={progressAvailable} />
  </section>;
}
