import { notFound, redirect } from "next/navigation";

type LegacyConceptPageProps = {
  params: Promise<{ courseId: string; conceptId: string }>;
  searchParams: Promise<{ conversationId?: string | string[]; notice?: string | string[] }>;
};

export default async function LegacyGroundedLearnPage({ params, searchParams }: LegacyConceptPageProps) {
  const [{ courseId, conceptId }, query] = await Promise.all([params, searchParams]);
  if (Array.isArray(query.conversationId) || Array.isArray(query.notice)) notFound();
  const destination = new URLSearchParams({ conceptId });
  if (query.conversationId) destination.set("conversationId", query.conversationId);
  if (query.notice === "retry") destination.set("notice", "retry");
  redirect(`/courses/${encodeURIComponent(courseId)}?${destination.toString()}`);
}
