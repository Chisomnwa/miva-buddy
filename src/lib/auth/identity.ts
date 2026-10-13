import type { User } from "@supabase/supabase-js";

/** Only an explicit false claim denotes a permanent Supabase Auth user. */
export function isPermanentUser(user: User | null | undefined): user is User {
  return user?.is_anonymous === false;
}

export function profileDestination(programme: string | null | undefined) {
  return programme ? "/home" : "/onboarding";
}
