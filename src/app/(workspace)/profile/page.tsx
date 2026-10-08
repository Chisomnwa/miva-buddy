import { ProfileForm } from "@/components/profile-form";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile, error } = user ? await getProfile(user.id) : { data: null, error: null };
  if (error) throw new Error("profile_lookup_failed");

  return (
    <section className="profile-page">
      <p className="eyebrow">YOUR PROFILE</p>
      <h1>Profile &amp; settings</h1>
      <p className="intro-copy">Keep your study details and interests up to date.</p>
      <div className="profile-card">
        <p className="field-static-label">Saved privately in this browser</p>
        <p className="field-static-value">Clearing browser data may remove access to this profile. Cross-device recovery is not available yet.</p>
        <hr />
        <ProfileForm
          careerInterests={profile?.career_interests ?? []}
          level={profile?.level ?? ""}
          programme={profile?.programme ?? ""}
          submitLabel="Save changes"
        />
      </div>
    </section>
  );
}
