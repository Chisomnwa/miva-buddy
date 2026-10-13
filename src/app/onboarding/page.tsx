import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/profile-form";
import { BrandLockup } from "@/components/brand-lockup";
import { getPermanentUser } from "@/lib/auth/permanent-user";
import { getProfile } from "@/lib/profile";

export default async function OnboardingPage() {
  const { user } = await getPermanentUser();
  if (!user) redirect("/sign-in");
  const { data: profile } = await getProfile(user.id);
  if (profile?.programme) redirect("/home");

  return (
    <main className="onboarding-screen">
      <section className="onboarding-card">
        <BrandLockup />
        <p className="eyebrow">A LITTLE ABOUT YOU</p>
        <h1>Welcome to your study space</h1>
        <p className="intro-copy">Your study area, level, and interests help make learning more relevant. You can change them later.</p>
        <ProfileForm />
        <p className="onboarding-note">A student-focused project for Miva learners; not an official university service. Your profile is stored privately with your signed-in account.</p>
      </section>
    </main>
  );
}
