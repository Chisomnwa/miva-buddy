import { LearnComposer } from "@/components/learn-composer";
import { RecentLearning } from "@/components/recent-learning";
import { createClient } from "@/lib/supabase/server";
import { getRecentLearnConversations } from "@/lib/learning";
import Link from "next/link";

export default async function LearnPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const recent = user ? await getRecentLearnConversations(user.id, 6) : [];

  return (
    <section className="learn-page">
      <p className="eyebrow">LEARN</p>
      <h1>Understand something</h1>
      <p className="intro-copy">Start with a question, or choose a concept from your course material for answers with source references.</p>
      <div className="learn-route-card">
        <div><p className="eyebrow">YOUR COURSE MATERIAL</p><h2>Learn with your notes</h2><p>Choose a ready concept in Courses to ask questions grounded in an uploaded PDF or pasted notes.</p></div>
        <Link className="button button-secondary" href="/courses">Browse Courses <span aria-hidden="true">→</span></Link>
      </div>
      <div className="general-learning-label">
        <span className="general-learning-dot" aria-hidden="true" />
        <div>
          <strong>General explanation</strong>
          <p>No course material is attached to this conversation.</p>
        </div>
      </div>
      <aside className="interview-preparation-entry" aria-label="Interview preparation in Learn">
        <strong>Preparing for an interview?</strong>
        <p>Name the company and, if you know it, the role. We’ll keep general preparation separate from verified candidate experiences.</p>
      </aside>
      <h2 className="learn-ask-heading">Ask a general question</h2>
      <div className="learning-disclosure" role="note">
        Your question and a limited amount of recent conversation may be sent to the configured AI provider to generate a reply. Avoid sharing sensitive personal information.
      </div>
      <LearnComposer suggestions={["Explain recursion with a small example", "How do hash tables work?", "Quiz me on binary search"]} />
      <RecentLearning conversations={recent} />
    </section>
  );
}
