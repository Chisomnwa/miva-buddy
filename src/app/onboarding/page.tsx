import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/profile-form";
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
        <span className="brand-mark" aria-hidden="true">m</span>
        <p className="eyebrow">A LITTLE ABOUT YOU</p>
        <h1>Welcome to your study space</h1>
        <p className="intro-copy">This helps us make learning more relevant. You can change it later. No sign-up or email needed.</p>
        <ProfileForm />
      </section>
    </main>
  );
}
