import { NextResponse } from "next/server";
import { profileDestination, isPermanentUser } from "@/lib/auth/identity";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/sign-in?error=oauth", requestUrl.origin));

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) return NextResponse.redirect(new URL("/sign-in?error=oauth", requestUrl.origin));

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !isPermanentUser(user)) {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // The identity is still rejected even if cleanup of an invalid session fails.
    }
    return NextResponse.redirect(new URL("/sign-in?error=session", requestUrl.origin));
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles").select("programme").eq("user_id", user.id).maybeSingle();
  if (profileError) return NextResponse.redirect(new URL("/sign-in?error=session", requestUrl.origin));

  return NextResponse.redirect(new URL(profileDestination(profile?.programme), requestUrl.origin));
}
