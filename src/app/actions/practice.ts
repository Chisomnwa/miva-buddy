"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { practiceModeSchema } from "@/contracts/practice";
import { createClient } from "@/lib/supabase/server";
import { getPracticeProblem, getPracticeTopic } from "@/server/practice/catalog";

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function startPracticeSessionAction(formData: FormData) {
  const slug = formData.get("problemSlug");
  const topicValue = formData.get("topicId");
  const conceptValue = formData.get("sourceConceptId");
  if (typeof slug !== "string") redirect("/practice");
  const problem = getPracticeProblem(slug);
  const topic = typeof topicValue === "string" ? getPracticeTopic(topicValue) : null;
  const topicId = topic && problem?.topics.includes(topic.id) ? topic.id : problem?.topics[0];
  const sourceConceptId = typeof conceptValue === "string" && /^[0-9a-f-]{36}$/i.test(conceptValue) ? conceptValue : null;
  if (!problem || !topicId) redirect("/practice");

  const { supabase, user } = await currentUser();
  if (!user) redirect("/onboarding");
  const { data: existing } = await supabase.from("practice_sessions").select("id")
    .eq("user_id", user.id).eq("problem_id", problem.id).eq("status", "in_progress").maybeSingle();
  if (existing) redirect(`/practice/session/${existing.id}`);

  const { data: created, error } = await supabase.from("practice_sessions").insert({
    user_id: user.id, problem_id: problem.id, problem_slug: problem.slug, topic_id: topicId,
    source_concept_id: sourceConceptId, mode: "coach", status: "in_progress",
  }).select("id").single();
  if (created) redirect(`/practice/session/${created.id}`);
  if (error && error.code !== "23505") console.error("Practice session insert rejected", { code: error.code });

  // Another tab may have created this user's active session at the same time.
  if (error?.code === "23505") {
    const { data: raced } = await supabase.from("practice_sessions").select("id")
      .eq("user_id", user.id).eq("problem_id", problem.id).eq("status", "in_progress").maybeSingle();
    if (raced) redirect(`/practice/session/${raced.id}`);
  }
  redirect(`/practice/topic/${topicId}?error=session`);
}

export async function savePracticeModeAction(sessionId: string, value: string) {
  const id = /^[0-9a-f-]{36}$/i.test(sessionId) ? sessionId : "";
  const mode = practiceModeSchema.safeParse(value);
  if (!id || !mode.success) return { error: "Choose a valid assistance mode." };
  const { supabase, user } = await currentUser();
  if (!user) return { error: "Your session expired. Refresh to continue." };
  const { data, error } = await supabase.from("practice_sessions").update({ mode: mode.data, updated_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", user.id).eq("status", "in_progress").select("id").maybeSingle();
  if (error || !data) return { error: "We couldn't save that mode. Please try again." };
  revalidatePath(`/practice/session/${id}`);
  return { error: null };
}

export async function completePracticeSessionAction(sessionId: string) {
  const id = /^[0-9a-f-]{36}$/i.test(sessionId) ? sessionId : "";
  if (!id) redirect("/practice");
  const { supabase, user } = await currentUser();
  if (!user) redirect("/onboarding");
  const { data, error } = await supabase.from("practice_sessions")
    .update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", user.id).eq("status", "in_progress").select("id").maybeSingle();
  if (error) redirect(`/practice/session/${id}?notice=completion_failed`);
  revalidatePath("/practice");
  revalidatePath("/home");
  if (!data) redirect(`/practice/session/${id}`);
  redirect(`/practice/session/${id}`);
}
