import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isPermanentUser } from "@/lib/auth/identity";

/** Safe, non-sensitive marker for temporary Supabase identity-verification failures. */
export class AuthVerificationError extends Error {
  constructor() {
    super("auth_verification_unavailable");
    this.name = "AuthVerificationError";
  }
}

export async function getPermanentUser(client?: SupabaseClient) {
  const supabase = client ?? await createClient();
  let verification: Awaited<ReturnType<typeof supabase.auth.getUser>>;
  try {
    verification = await supabase.auth.getUser();
  } catch {
    throw new AuthVerificationError();
  }
  const { data: { user }, error } = verification;
  if (error) throw new AuthVerificationError();
  return {
    supabase,
    user: !isPermanentUser(user) ? null : user,
  };
}
