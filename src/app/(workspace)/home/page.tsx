import Link from "next/link";
import { getPermanentUser } from "@/lib/auth/permanent-user";
import { getProfile } from "@/lib/profile";
import { getRecentLearnConversations } from "@/lib/learning";
import { RecentLearning } from "@/components/recent-learning";
import { PracticeResumeSection } from "@/components/practice-resume-section";
import { getPracticeProblem, getPracticeTopic } from "@/server/practice/catalog";
import { displayCourseTitle } from "@/lib/course-title-display";

export default async function HomePage() {
  const { supabase, user } = await getPermanentUser();
  const { data: profile, error: profileError } = user ? await getProfile(user.id) : { data: null, error: null };
  if (profileError) throw new Error("profile_lookup_failed");
  const recent = user ? await getRecentLearnConversations(user.id, 6) : [];
  const { data: courses, error: coursesError } = user ? await supabase.from("courses")
    .select("id,title,course_code").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(3)
    : { data: [], error: null };
  if (coursesError) throw new Error("home_courses_lookup_failed");
  const { data: practiceSessions, error: practiceError } = user ? await supabase.from("practice_sessions")
    .select("id,problem_slug,topic_id,mode,updated_at").eq("user_id", user.id).eq("status", "in_progress")
    .order("updated_at", { ascending: false }).limit(10) : { data: [], error: null };
  if (practiceError) throw new Error("practice_resume_lookup_failed");
  const resumablePracticeSessions = (practiceSessions ?? []).flatMap((session) => {
    const problem = getPracticeProblem(session.problem_slug);
    if (!problem) return [];
    const topic = getPracticeTopic(session.topic_id);
    const mode = session.mode === "coach" ? "Coach" : session.mode === "tutor" ? "Tutor" : "Hands Off";
    return [{
      id: session.id,
      title: problem.title,
      difficulty: problem.difficulty,
      mode: session.mode,
      metadata: `${topic?.label ?? "Practice"} · ${mode}`,
    }];
  });
  const firstName = profile?.programme ? (user?.user_metadata?.name as string | undefined)?.split(" ")[0] : undefined;

  return (
    <>
      <section className="welcome-block">
        <p className="eyebrow">YOUR LEARNING COMPANION</p>
        <h1>{firstName ? `Good to see you, ${firstName}.` : "What would you like to learn today?"}</h1>
        <p className="intro-copy">A steady place to understand your coursework and practise what matters.</p>
        <Link className="button button-primary" href="/learn">Ask a question <span aria-hidden="true">→</span></Link>
      </section>
      <section className="home-grid" aria-label="Ways to get started">
        <article className="start-card">
          <span className="card-symbol" aria-hidden="true">01</span>
          <p className="eyebrow">LEARN</p>
          <h2>Understand a concept</h2>
          <p>Ask a question now, or continue a conversation you started earlier.</p>
          <Link className="text-link" href="/learn">Go to Learn <span aria-hidden="true">→</span></Link>
        </article>
        <article className="start-card">
          <span className="card-symbol card-symbol-red" aria-hidden="true">02</span>
          <p className="eyebrow">COURSES</p>
          <h2>Learn from your material</h2>
          <p>Keep notes and PDFs organized, then explore concepts with source references.</p>
          <Link className="text-link" href="/courses">Open Courses <span aria-hidden="true">→</span></Link>
        </article>
        <article className="start-card">
          <span className="card-symbol" aria-hidden="true">03</span>
          <p className="eyebrow">PRACTISE DSA</p>
          <h2>Build problem-solving confidence</h2>
          <p>Choose a curated problem and get help in the mode that feels right for you.</p>
          <Link className="text-link" href="/practice">Explore Practice <span aria-hidden="true">→</span></Link>
        </article>
      </section>
      {courses && courses.length > 0 && <section className="recent-learning" aria-labelledby="home-courses-heading">
        <div className="section-heading-row"><h2 id="home-courses-heading">Your courses</h2><Link className="text-link" href="/courses">All courses</Link></div>
        <ul className="recent-learning-list">{courses.map((course) => <li key={course.id}><Link href={`/courses/${course.id}`}>
          <span>{displayCourseTitle(course.title)}<small className="practice-list-meta">{course.course_code || "Course materials"}</small></span><span aria-hidden="true">→</span>
        </Link></li>)}</ul>
      </section>}
      <PracticeResumeSection
        items={resumablePracticeSessions}
        heading="Continue Practice"
        allTopicsHref="/practice"
        className="recent-learning"
      />
      <RecentLearning conversations={recent} collapsible />
      <p className="home-footnote">{profile?.programme ? `${profile.programme} · ${profile.level}` : "Your learning progress will appear here as you go."}</p>
    </>
  );
}
