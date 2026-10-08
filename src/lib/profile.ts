import "server-only";
import { createClient } from "@/lib/supabase/server";

export type StudentProfile = {
  user_id: string;
  programme: string;
  level: string;
  career_interests: string[];
  created_at: string;
  updated_at: string;
};

export async function getProfile(userId: string) {
  const supabase = await createClient();
  return supabase
    .from("profiles")
    .select("user_id, programme, level, career_interests, created_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
}
