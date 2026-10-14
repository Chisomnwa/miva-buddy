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
      {query.notice === "usage_limit" && (
        <p className="form-error" role="status">The shared AI usage limit has been reached for now. Please try again later.</p>
      )}
      {query.notice === "provider_quota" && <p className="form-error" role="status">The AI service is at its current usage limit. Please try again later.</p>}
      {query.notice === "generation_timeout" && <p className="form-error" role="status">That took longer than expected. Please try again shortly.</p>}
      {query.notice === "provider_configuration" && <p className="form-error" role="status">AI is temporarily unavailable. Please try again later.</p>}
      {query.notice === "provider_rejected" && <p className="form-error" role="status">We couldn’t process that request safely. Please rephrase and try again.</p>}
      {query.notice === "provider_unavailable" && <p className="form-error" role="status">The AI service is temporarily unavailable. Please try again shortly.</p>}
      <LearnConversation messages={result.messages} />
      <div className="learning-disclosure" role="note">
        Avoid sharing sensitive personal information.
      </div>
      <LearnComposer conversationId={conversationId} suggestions={lastAssistant?.follow_up_questions ?? []} />
    </section>
  );
}
