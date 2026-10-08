import Link from "next/link";
import type { RecentLearnConversation } from "@/lib/learning";

export function RecentLearning({ conversations }: { conversations: RecentLearnConversation[] }) {
  if (conversations.length === 0) return null;
  return (
    <section className="recent-learning" aria-labelledby="recent-learning-title">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">PICK UP WHERE YOU LEFT OFF</p>
          <h2 id="recent-learning-title">Recent learning</h2>
        </div>
      </div>
      <ul className="recent-learning-list">
        {conversations.map((conversation) => (
          <li key={conversation.id}>
            <Link href={`/learn/${conversation.id}`}>
              <span>{conversation.title}</span>
              <span aria-hidden="true">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
