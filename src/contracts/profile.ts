import { z } from "zod";

export const careerInterestOptions = [
  "Software Engineering",
  "Data Engineering",
  "Backend Engineering",
  "Machine Learning",
] as const;

export const studentLevelOptions = [
  "100 Level",
  "200 Level",
  "300 Level",
  "400 Level",
  "Other",
] as const;

export function getStudentLevelDefault(level: string | undefined) {
  if (!level) return studentLevelOptions[0];
  return studentLevelOptions.find((option) => option === level) ?? "";
}

export const profileInputSchema = z.object({
  programme: z.string().trim().min(2).max(100),
  level: z.string().trim().pipe(z.enum(studentLevelOptions)),
  careerInterests: z.array(z.enum(careerInterestOptions)).max(careerInterestOptions.length),
});
