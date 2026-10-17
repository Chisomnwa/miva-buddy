import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicSupabaseConfig } from "@/lib/config";
import { classifyAuthVerificationFailure, hasSupabaseAuthCookieName, logAuthVerificationDiagnostic } from "@/lib/auth/verification-diagnostics";

function isProtectedPath(pathname: string): boolean {
  return /^\/(?:home|learn|courses|practice|profile|onboarding)(?:\/|$)/.test(pathname)
    || /^\/api\/(?:learn|practice)(?:\/|$)/.test(pathname);
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = getPublicSupabaseConfig();

  if (!config) return response;

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const authCookiePresent = hasSupabaseAuthCookieName(request.cookies.getAll().map(({ name }) => name));
  try {
    const { data, error } = await supabase.auth.getClaims();
    if (error) {
      logAuthVerificationDiagnostic(classifyAuthVerificationFailure(error), authCookiePresent);
    } else if (isProtectedPath(request.nextUrl.pathname) && !data?.claims) {
      logAuthVerificationDiagnostic("missing_session", authCookiePresent);
    }
  } catch (error) {
    logAuthVerificationDiagnostic(classifyAuthVerificationFailure(error), authCookiePresent);
  }
  return response;
}
