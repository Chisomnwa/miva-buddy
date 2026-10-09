import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/profile-form";
import { BrandLockup } from "@/components/brand-lockup";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user ? await getProfile(user.id) : { data: null };
  if (profile?.programme) redirect("/home");

  return (
    <main className="onboarding-screen">
      <section className="onboarding-card">
        <BrandLockup />
        <p className="eyebrow">A LITTLE ABOUT YOU</p>
        <h1>Welcome to your study space</h1>
        <p className="intro-copy">Your study area, level, and interests help make learning more relevant. You can change them later. No sign-up or email needed.</p>
        <ProfileForm />
        <p className="onboarding-note">A student-focused project for Miva learners; not an official university service. Your profile is stored online under an anonymous browser identity. Clearing browser data may make it inaccessible.</p>
      </section>
    </main>
  );
}
