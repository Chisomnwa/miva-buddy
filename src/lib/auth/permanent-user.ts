import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isPermanentUser } from "@/lib/auth/identity";

export async function getPermanentUser(client?: SupabaseClient) {
  const supabase = client ?? await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return {
    supabase,
    user: error || !isPermanentUser(user) ? null : user,
  };
}
