import type { GenerationInput, GenerationProvider } from "../provider";

export class FakeGenerationProvider implements GenerationProvider {
  private readonly outputs: string[];
  private calls = 0;

  constructor(outputs?: string[]) {
    this.outputs = outputs ?? [];
  }

  async generate(input: GenerationInput): Promise<string> {
    if (input.signal.aborted) throw new DOMException("Aborted", "AbortError");
    const configuredOutput = this.outputs[this.calls];
    this.calls += 1;
    if (configuredOutput !== undefined) return configuredOutput;

    const responseSchema = input.responseSchema as {
      properties?: {
        concepts?: unknown;
        segments?: { items?: { properties?: Record<string, unknown> } };
      };
    };
    const userContent = [...input.messages].reverse().find((message) => message.role === "user")?.content ?? "";

    if (responseSchema.properties?.concepts) {
      const data = parseJson(userContent);
      const evidence = Array.isArray(data?.excerpts) ? data.excerpts : [];
      const first = evidence.find((item): item is { id: string; content: string } =>
        typeof item === "object" && item !== null && typeof item.id === "string" && typeof item.content === "string",
      );
      if (!first) return JSON.stringify({ concepts: [] });
      const sentence = first.content.split(/(?<=[.!?])\s+/)[0]?.trim() || first.content.trim();
      const title = sentence.slice(0, 120).trim().replace(/[.!?]+$/, "") || "Course concept";
      return JSON.stringify({ concepts: [{ title, description: sentence.slice(0, 1000), supportingChunkIds: [first.id] }] });
    }

    const segmentProperties = responseSchema.properties?.segments?.items?.properties;
    if (segmentProperties && "citationIds" in segmentProperties) {
      const data = parseJson(userContent);
      const evidence = Array.isArray(data?.courseExcerpts) ? data.courseExcerpts : [];
      const first = evidence.find((item): item is { chunk_id: string; content: string } =>
        typeof item === "object" && item !== null && typeof item.chunk_id === "string" && typeof item.content === "string",
      );
      if (!first) {
        return JSON.stringify({
          segments: [{ kind: "no_support", content: "The available course material does not provide enough evidence to answer this question.", citationIds: [] }],
          followUpQuestions: [],
        });
      }
      return JSON.stringify({
        segments: [{ kind: "grounded", content: `Your course material says: ${first.content.slice(0, 700)}`, citationIds: [first.chunk_id] }],
        followUpQuestions: ["Would you like to unpack one part of this passage?"],
      });
    }

    if (segmentProperties) {
      return JSON.stringify({ segments: [
        { kind: "observation", content: "I’ll focus on the details you shared.", format: "prose", references: [] },
        { kind: "reflection_question", content: "Which part of your approach feels least certain right now?", format: "prose", references: [] },
      ] });
    }

    const prompt = userContent || "this idea";
    const topic = prompt.replace(/\s+/g, " ").trim().slice(0, 90);
    return JSON.stringify({
      answer: `Let’s unpack ${topic} step by step. Start by identifying the core idea, then connect it to a small example. As you work through that example, notice what changes at each step and why.`,
      followUpQuestions: ["Would you like a simpler explanation?", "Can we work through an example?"],
    });
  }
}

function parseJson(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}
