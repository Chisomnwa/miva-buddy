import Link from "next/link";
import { notFound } from "next/navigation";
import { LearnComposer } from "@/components/learn-composer";
import { LearnConversation } from "@/components/learn-conversation";
import { getPermanentUser } from "@/lib/auth/permanent-user";
import { getLearnConversation } from "@/lib/learning";

type LearnConversationPageProps = {
  params: Promise<{ conversationId: string }>;
  searchParams: Promise<{ notice?: string }>;
};

export default async function LearnConversationPage({ params, searchParams }: LearnConversationPageProps) {
  const [{ conversationId }, query] = await Promise.all([params, searchParams]);
  const { user } = await getPermanentUser();
  if (!user) notFound();

  const result = await getLearnConversation(user.id, conversationId);
  if (!result) notFound();
  const lastAssistant = [...result.messages].reverse().find((message) => message.role === "assistant");

  return (
    <section className="learn-page learn-thread-page">
      <Link className="back-link" href="/learn">← All learning</Link>
      <p className="eyebrow">GENERAL EXPLANATION · NO COURSE MATERIAL ATTACHED</p>
      <h1>{result.conversation.title}</h1>
      {query.notice === "retry" && (
        <p className="form-error" role="alert">We couldn’t get a response just now. Your question is saved; you can try again below.</p>
      )}
      <LearnConversation messages={result.messages} />
      <div className="learning-disclosure" role="note">
        Your message and up to 8 recent messages from this conversation may be sent to the configured AI provider. Avoid sharing sensitive personal information.
      </div>
      <LearnComposer conversationId={conversationId} suggestions={lastAssistant?.follow_up_questions ?? []} />
    </section>
  );
}
