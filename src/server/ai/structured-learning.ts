import { ZodError } from "zod";
import { learnResponseSchema, type LearnResponse } from "@/contracts/learning";
import type { GenerationMessage, GenerationProvider } from "./provider";
import { learningReplyJsonSchema } from "./learning-prompt";
import { MalformedProviderOutputError } from "./provider";

export async function generateLearningReply(
  provider: GenerationProvider,
  messages: GenerationMessage[],
  signal: AbortSignal,
): Promise<LearnResponse> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const requestMessages = attempt === 0
      ? messages
      : [...messages, {
          role: "user" as const,
          content: "Your previous response did not match the required response shape. Return only a valid JSON object with string answer and an array followUpQuestions (at most three). Do not change the educational response.",
        }];
    try {
      const raw = await provider.generate({
        messages: requestMessages,
        responseSchema: learningReplyJsonSchema,
        signal,
      });
      return learnResponseSchema.parse(JSON.parse(raw));
    } catch (error) {
      if (!(error instanceof MalformedProviderOutputError) && !(error instanceof SyntaxError) && !(error instanceof ZodError)) {
        throw error;
      }
      if (attempt === 1) throw new MalformedProviderOutputError();
    }
  }

  throw new MalformedProviderOutputError();
}
