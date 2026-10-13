import Link from "next/link";
import { notFound } from "next/navigation";
import { startPracticeSessionAction } from "@/app/actions/practice";
import { getPermanentUser } from "@/lib/auth/permanent-user";
import { getPracticeProblemsForTopic, getPracticeTopic } from "@/server/practice/catalog";
import { latestPracticeStateByProblem } from "@/lib/practice-session-display";
import { practiceDifficultySchema, type PracticeDifficulty } from "@/contracts/practice";

export default async function PracticeTopicPage({ params, searchParams }: {
  params: Promise<{ topicId: string }>;
  searchParams: Promise<{ conceptId?: string; error?: string; difficulty?: string }>;
}) {
  const [{ topicId }, query] = await Promise.all([params, searchParams]);
  const topic = getPracticeTopic(topicId);
  if (!topic) notFound();
  const { supabase, user } = await getPermanentUser();
  let conceptId = "";
  if (query.conceptId && /^[0-9a-f-]{36}$/i.test(query.conceptId)) {
    if (user) {
      const { data, error } = await supabase.from("course_concepts").select("id").eq("id", query.conceptId).eq("user_id", user.id).maybeSingle();
      if (error) throw new Error("concept_lookup_failed");
      if (data) conceptId = data.id;
    }
  }
  const problems = getPracticeProblemsForTopic(topic.id);
  const parsedDifficulty = practiceDifficultySchema.safeParse(query.difficulty);
  const difficulty = parsedDifficulty.success ? parsedDifficulty.data : null;
  const visibleProblems = difficulty ? problems.filter((problem) => problem.difficulty === difficulty) : problems;
  const filterHref = (value: PracticeDifficulty | null) => {
    const params = new URLSearchParams();
    if (conceptId) params.set("conceptId", conceptId);
    if (value) params.set("difficulty", value);
    const suffix = params.toString();
    return `/practice/topic/${topic.id}${suffix ? `?${suffix}` : ""}`;
  };
  const { data: sessions, error: sessionsError } = user ? await supabase.from("practice_sessions")
    .select("id,problem_slug,status,updated_at").eq("user_id", user.id)
    .in("problem_slug", problems.map((problem) => problem.slug)).order("updated_at", { ascending: false })
    : { data: [], error: null };
  if (sessionsError) throw new Error("practice_topic_sessions_lookup_failed");
  const latestByProblem = latestPracticeStateByProblem(sessions ?? []);
  return <section className="simple-page practice-page">
    <Link className="back-link" href="/practice">← All topics</Link>
    <p className="eyebrow">DSA PATTERN</p><h1>{topic.label}</h1><p className="intro-copy">{topic.description}</p>
    {query.error === "session" && <p className="form-error" role="alert">We couldn&apos;t save this practice session. Please try again.</p>}
    <p className="practice-discovery-note">Problem titles and difficulty come from our curated catalog. Solve on LeetCode; Miva Buddy does not see submissions.</p>
    <nav className="practice-difficulty-filter" aria-label="Filter problems by difficulty">
      {([null, "Easy", "Medium", "Hard"] as const).map((value) => <Link key={value ?? "all"} href={filterHref(value)} aria-current={difficulty === value ? "page" : undefined}>
        {value ?? "All"} <span>{value ? problems.filter((problem) => problem.difficulty === value).length : problems.length}</span>
      </Link>)}
    </nav>
    <p className="practice-result-count" role="status">Showing {visibleProblems.length} of {problems.length} problems in learning order</p>
    {visibleProblems.length === 0 && <p className="empty-state">No {difficulty} problems in this pattern. Choose another difficulty above.</p>}
    <ul className="practice-problem-list">{visibleProblems.map((problem) => {
      const session = latestByProblem.get(problem.slug);
      return <li className="practice-problem-card" key={problem.id}>
      <div><p className="eyebrow">{problem.difficulty} · LEETCODE #{problem.id}</p><h2>{problem.title}</h2><p className="practice-tags">{problem.tags.join(" · ")}</p>
        {session?.status === "completed" && <p className="practice-completion-note">Marked complete by you · LeetCode not verified</p>}
      </div>
      {session?.status === "in_progress" ? <Link className="button button-secondary" href={`/practice/session/${session.id}`}>Resume practice <span aria-hidden="true">→</span></Link>
      : <form action={startPracticeSessionAction}>
        <input type="hidden" name="problemSlug" value={problem.slug} />
        <input type="hidden" name="topicId" value={topic.id} />
        {conceptId && <input type="hidden" name="sourceConceptId" value={conceptId} />}
        <button className="button button-primary" type="submit">Start practice <span aria-hidden="true">→</span></button>
      </form>}
    </li>; })}</ul>
  </section>;
}
