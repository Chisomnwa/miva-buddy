import { z } from "zod";

export const careerInterestOptions = [
  "Software Engineering",
  "Data Engineering",
  "Backend Engineering",
  "Machine Learning",
] as const;

export const profileInputSchema = z.object({
  programme: z.string().trim().min(2).max(100),
  level: z.string().trim().min(2).max(40),
  careerInterests: z.array(z.enum(careerInterestOptions)).max(careerInterestOptions.length),
});
