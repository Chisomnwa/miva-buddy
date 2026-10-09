import Link from "next/link";
import type { RecentLearnConversation } from "@/lib/learning";

const DEFAULT_VISIBLE_COUNT = 3;

function ConversationLink({ conversation }: { conversation: RecentLearnConversation }) {
  return (
    <li className="recent-learning-conversation">
      <Link href={`/learn/${conversation.id}`}>
        <span>{conversation.title}</span>
        <span aria-hidden="true">→</span>
      </Link>
    </li>
  );
}

export function RecentLearning({ conversations, collapsible = false }: { conversations: RecentLearnConversation[]; collapsible?: boolean }) {
  if (conversations.length === 0) return null;
  const visible = collapsible ? conversations.slice(0, DEFAULT_VISIBLE_COUNT) : conversations;
  const remaining = collapsible ? conversations.slice(DEFAULT_VISIBLE_COUNT) : [];

  return (
    <section className="recent-learning" aria-labelledby="recent-learning-title">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">PICK UP WHERE YOU LEFT OFF</p>
          <h2 id="recent-learning-title">Recent learning</h2>
        </div>
      </div>
      <ul className="recent-learning-list">
        {visible.map((conversation) => <ConversationLink conversation={conversation} key={conversation.id} />)}
      </ul>
      {remaining.length > 0 && <details className="recent-learning-expansion">
        <summary className="practice-resume-toggle" aria-controls="recent-learning-more">
          <span className="recent-learning-more-label">Show {remaining.length} more conversations</span>
          <span className="recent-learning-less-label">Show less</span>
        </summary>
        <ul className="recent-learning-list recent-learning-list-more" id="recent-learning-more">
          {remaining.map((conversation) => <ConversationLink conversation={conversation} key={conversation.id} />)}
        </ul>
      </details>}
    </section>
  );
}
