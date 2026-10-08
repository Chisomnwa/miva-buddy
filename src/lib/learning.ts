import "server-only";
import { learnStoredMessageSchema } from "@/contracts/learning";
import { createClient } from "@/lib/supabase/server";

export type RecentLearnConversation = {
  id: string;
  title: string;
  updated_at: string;
};

export async function getRecentLearnConversations(userId: string, limit = 4): Promise<RecentLearnConversation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("learn_conversations")
    .select("id, title, updated_at, course_id")
    .eq("user_id", userId)
    .is("course_id", null)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error || !data) throw new Error("recent_learning_lookup_failed");
  return data as RecentLearnConversation[];
}

export async function getLearnConversation(userId: string, conversationId: string) {
  const supabase = await createClient();
  const { data: conversation, error: conversationError } = await supabase
    .from("learn_conversations")
    .select("id, title, updated_at, course_id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (conversationError) throw new Error("learning_conversation_lookup_failed");
  if (!conversation || conversation.course_id !== null) return null;

  const { data, error } = await supabase
    .from("learn_messages")
    .select("id, role, content, follow_up_questions, created_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error || !data) throw new Error("learning_messages_lookup_failed");
  const messages = learnStoredMessageSchema.array().safeParse(data);
  if (!messages.success) throw new Error("learning_messages_invalid");
  return { conversation, messages: messages.data };
}
