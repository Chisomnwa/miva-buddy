"use server";

import { redirect } from "next/navigation";
import { profileInputSchema } from "@/contracts/profile";
import { getPermanentUser } from "@/lib/auth/permanent-user";

export type FormResult = { error: string | null };

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function saveProfileAction(
  _previous: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const parsed = profileInputSchema.safeParse({
    programme: readString(formData, "programme"),
    level: readString(formData, "level"),
    careerInterests: formData.getAll("careerInterests").filter((v): v is string => typeof v === "string"),
  });
  if (!parsed.success) return { error: "Please enter your programme and level." };

  const { supabase, user } = await getPermanentUser();
  if (!user) return { error: "Please sign in with Google before saving your profile." };

  const { error } = await supabase.from("profiles").upsert({
    user_id: user.id,
    programme: parsed.data.programme,
    level: parsed.data.level,
    career_interests: parsed.data.careerInterests,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: "We couldn't save your profile. Please try again." };

  redirect(readString(formData, "saveContext") === "profile" ? "/profile?saved=1" : "/home");
}
