import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace-shell";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/onboarding");
  const { data: profile, error } = await getProfile(user.id);
  if (error) throw new Error("profile_lookup_failed");
  if (!profile?.programme) redirect("/onboarding");
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
