import { LearnComposer } from "@/components/learn-composer";
import { RecentLearning } from "@/components/recent-learning";
import { createClient } from "@/lib/supabase/server";
import { getRecentLearnConversations } from "@/lib/learning";

export default async function LearnPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const recent = user ? await getRecentLearnConversations(user.id, 6) : [];

  return (
    <section className="learn-page">
      <p className="eyebrow">LEARN</p>
      <h1>Understand something</h1>
      <p className="intro-copy">Ask about a concept, build an intuition, and follow up when you need more.</p>
      <div className="general-learning-label">
        <span className="general-learning-dot" aria-hidden="true" />
        <div>
          <strong>General explanation</strong>
          <p>No course material is attached to this conversation.</p>
        </div>
      </div>
      <div className="learning-disclosure" role="note">
        Your question and a limited amount of recent conversation may be sent to the configured AI provider to generate a reply. Avoid sharing sensitive personal information.
      </div>
      <LearnComposer />
      <RecentLearning conversations={recent} />
    </section>
  );
}
