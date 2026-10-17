"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function GoogleSignInButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setPending(true);
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (oauthError) throw new Error("oauth_start_failed");
    } catch {
      setError("Google sign-in could not start. Please try again.");
      setPending(false);
    }
  }

  return (
    <div className="google-sign-in">
      <button className="button button-primary button-wide" disabled={pending} onClick={signIn} type="button">
        {pending ? "Connecting to Google…" : "Continue with Google"}
      </button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
