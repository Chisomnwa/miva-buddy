import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getPermanentUser } from "@/lib/auth/permanent-user";
import { getProfile } from "@/lib/profile";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { user } = await getPermanentUser();
  if (!user) redirect("/sign-in");
  const { data: profile, error } = await getProfile(user.id);
  if (error) throw new Error("profile_lookup_failed");
  if (!profile?.programme) redirect("/onboarding");
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
