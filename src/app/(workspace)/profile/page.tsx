import { ProfileForm } from "@/components/profile-form";
import { getPermanentUser } from "@/lib/auth/permanent-user";
import { getProfile } from "@/lib/profile";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ saved?: string; signOutError?: string }> }) {
  const { saved, signOutError } = await searchParams;
  const { user } = await getPermanentUser();
  if (!user) redirect("/sign-in");
  const { data: profile, error } = await getProfile(user.id);
  if (error) throw new Error("profile_lookup_failed");

  return (
    <section className="profile-page">
      <p className="eyebrow">YOUR PROFILE</p>
      <h1>Profile &amp; settings</h1>
      <p className="intro-copy">Keep your study details and interests up to date.</p>
      <div className="profile-card">
        <p className="field-static-label">Your account</p>
        <p className="field-static-value">Your profile and learning data are stored privately with your signed-in Google account.</p>
        <hr />
        {saved === "1" && <p className="form-success" role="status">Profile changes saved.</p>}
        {signOutError === "1" && <p className="form-error" role="alert">We couldn’t finish signing out. Please retry.</p>}
        <ProfileForm
          careerInterests={profile?.career_interests ?? []}
          level={profile?.level ?? ""}
          programme={profile?.programme ?? ""}
          submitLabel="Save changes"
          saveContext="profile"
        />
      </div>
    </section>
  );
}
import { redirect } from "next/navigation";
