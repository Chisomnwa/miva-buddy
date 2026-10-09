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
      <section className="learn-general-question-card" aria-labelledby="learn-ask-heading">
        <h2 className="learn-ask-heading" id="learn-ask-heading">Ask a general question</h2>
        <div className="learning-disclosure" role="note">
          Avoid sharing sensitive personal information.
        </div>
        <LearnComposer
          beforeSuggestions={
            <aside className="learn-interview-prompt" aria-label="Interview preparation">
              <h3>Preparing for an interview?</h3>
              <p>Ask a question about a company, role, or interview stage. Preparation is general guidance; external searches are not verified candidate experiences.</p>
            </aside>
          }
          suggestions={["Explain recursion with a small example", "How do hash tables work?", "Quiz me on binary search"]}
        />
      </section>
      <RecentLearning conversations={recent} collapsible />
    </section>
  );
}
