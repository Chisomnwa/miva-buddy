import { NextResponse } from "next/server";
import { profileDestination, isPermanentUser, resolveAppBaseUrl } from "@/lib/auth/identity";
import { createClient, hasSupabaseAuthCookie } from "@/lib/supabase/server";
import { classifyAuthVerificationFailure, logAuthVerificationDiagnostic } from "@/lib/auth/verification-diagnostics";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const appOrigin = resolveAppBaseUrl(requestUrl);
  if (!appOrigin) {
    return NextResponse.json({ error: "oauth_callback_unavailable" }, { status: 500 });
  }
  const redirect = (path: string) => NextResponse.redirect(new URL(path, appOrigin));
  const code = requestUrl.searchParams.get("code");
  if (!code) return redirect("/sign-in?error=oauth");

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) return redirect("/sign-in?error=oauth");

  let verification: Awaited<ReturnType<typeof supabase.auth.getUser>>;
  try {
    verification = await supabase.auth.getUser();
  } catch (error) {
    const category = classifyAuthVerificationFailure(error);
    logAuthVerificationDiagnostic(category, await hasSupabaseAuthCookie());
    return redirect(category === "missing_session" || category === "token_rejected"
      ? "/sign-in?error=session"
      : "/sign-in?error=verification");
  }
  const { data: { user }, error: userError } = verification;
  if (userError) {
    const category = classifyAuthVerificationFailure(userError);
    logAuthVerificationDiagnostic(category, await hasSupabaseAuthCookie());
    return redirect(category === "missing_session" || category === "token_rejected"
      ? "/sign-in?error=session"
      : "/sign-in?error=verification");
  }
  if (!isPermanentUser(user)) {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // The identity is still rejected even if cleanup of an invalid session fails.
    }
    return redirect("/sign-in?error=session");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles").select("programme").eq("user_id", user.id).maybeSingle();
  if (profileError) return redirect("/sign-in?error=session");

  return redirect(profileDestination(profile?.programme));
}
