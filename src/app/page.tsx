import { redirect } from "next/navigation";
import { getPublicSupabaseConfig } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { BrandLockup } from "@/components/brand-lockup";

export const dynamic = "force-dynamic";

export default async function IndexPage() {
  if (!getPublicSupabaseConfig()) {
    return (
      <main className="setup-screen">
        <div className="setup-card">
          <BrandLockup />
          <p className="eyebrow">MIVA BUDDY · SETUP</p>
          <h1>Connect your Supabase project</h1>
          <p className="intro-copy">Add the Supabase project URL (origin only, with no REST/Auth path) and publishable key to enable onboarding and saved profiles.</p>
          <pre className="env-example">NEXT_PUBLIC_SUPABASE_URL={"<project-url>"}{"\n"}NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY={"<publishable-key>"}</pre>
          <p className="setup-note">The publishable key is intended for the browser and must be paired with the database access policies. Keep database credentials server-side.</p>
        </div>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/onboarding");
  const { data: profile } = await getProfile(user.id);
  redirect(profile?.programme ? "/home" : "/onboarding");
}
