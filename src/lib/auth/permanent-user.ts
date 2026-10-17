import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, hasSupabaseAuthCookie } from "@/lib/supabase/server";
import { isPermanentUser } from "@/lib/auth/identity";
import { classifyAuthVerificationFailure, logAuthVerificationDiagnostic } from "@/lib/auth/verification-diagnostics";

/** Safe, non-sensitive marker for temporary Supabase identity-verification failures. */
export class AuthVerificationError extends Error {
  constructor() {
    super("auth_verification_unavailable");
    this.name = "AuthVerificationError";
  }
}

async function resolvePermanentUser(client?: SupabaseClient) {
  const supabase = client ?? await createClient();
  const handleVerificationFailure = async (error: unknown) => {
    const category = classifyAuthVerificationFailure(error);
    logAuthVerificationDiagnostic(category, await hasSupabaseAuthCookie());
    if (category === "missing_session" || category === "token_rejected") {
      return { supabase, user: null };
    }
    throw new AuthVerificationError();
  };

  let verification: Awaited<ReturnType<typeof supabase.auth.getUser>>;
  try {
    verification = await supabase.auth.getUser();
  } catch (error) {
    return handleVerificationFailure(error);
  }
  const { data: { user }, error } = verification;
  if (error) return handleVerificationFailure(error);
  if (!user) {
    logAuthVerificationDiagnostic("missing_session", await hasSupabaseAuthCookie());
    return { supabase, user: null };
  }
  return {
    supabase,
    user: !isPermanentUser(user) ? null : user,
  };
}

/** Reuse verification within one Server Component render (e.g. layout + page). */
export const getPermanentUser = cache(resolvePermanentUser);
