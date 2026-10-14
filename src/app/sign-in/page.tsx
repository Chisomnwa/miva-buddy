import { redirect } from "next/navigation";
import { BrandLockup } from "@/components/brand-lockup";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { getPermanentUser } from "@/lib/auth/permanent-user";

export const dynamic = "force-dynamic";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string; signedOut?: string }> }) {
  const { user } = await getPermanentUser();
  if (user) redirect("/");
  const params = await searchParams;

  return (
    <main className="onboarding-screen">
      <section className="onboarding-card">
        <BrandLockup />
        <p className="eyebrow">YOUR MIVA STUDY SPACE</p>
        <h1>Sign in to Miva Buddy</h1>
        <p className="intro-copy">Use your Google account to save your courses and continue learning across visits.</p>
        {params.error === "oauth" && <p className="form-error" role="alert">Google sign-in didn’t complete. Please try again.</p>}
        {params.error === "verification" && <p className="form-error" role="alert">We couldn’t verify your session just now. Please try again shortly.</p>}
        {params.error === "session" && <p className="form-error" role="alert">We couldn’t verify your sign-in. Please try again.</p>}
        {params.signedOut === "1" && <p className="form-success" role="status">You’ve been signed out.</p>}
        <GoogleSignInButton />
        <p className="onboarding-note">Your profile and learning data stay private to your account. Miva Buddy is an independent student project, not an official university service.</p>
      </section>
    </main>
  );
}
