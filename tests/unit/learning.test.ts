import { describe, expect, it, vi } from "vitest";
import { learnRequestSchema, learnResponseSchema } from "@/contracts/learning";
import { learningReplyJsonSchema, learningSystemPrompt, selectRecentContext } from "@/server/ai/learning-prompt";
import type { GenerationInput, GenerationProvider } from "@/server/ai/provider";
import { FakeGenerationProvider } from "@/server/ai/providers/fake";
import { GeminiGenerationProvider } from "@/server/ai/providers/gemini";
import { GroqGenerationProvider } from "@/server/ai/providers/groq";
import { OllamaGenerationProvider } from "@/server/ai/providers/ollama";
import { MalformedProviderOutputError } from "@/server/ai/provider";
import { generateLearningReply } from "@/server/ai/structured-learning";

const messages = [
  { role: "system" as const, content: learningSystemPrompt },
  { role: "user" as const, content: "Explain binary trees" },
];

function signal() {
  return new AbortController().signal;
}

describe("direct learning contracts and provider boundary", () => {
  it("requests structured formatting for explicit walkthroughs but keeps ordinary answers concise", () => {
    expect(learningSystemPrompt).toContain("use clear numbered steps");
    expect(learningSystemPrompt).toContain("fenced text block for a state trace or diagram");
    expect(learningSystemPrompt).toContain("Keep ordinary answers focused and concise");
    expect(learningSystemPrompt).toContain("Do not force a detailed template on ordinary questions");
  });

  it("validates bounded requests and structured replies", () => {
    expect(learnRequestSchema.safeParse({ message: "  Explain heaps  " }).success).toBe(true);
    expect(learnRequestSchema.safeParse({ message: "x" }).success).toBe(false);
    expect(learnRequestSchema.safeParse({ message: "x".repeat(2_001) }).success).toBe(false);
    expect(learnResponseSchema.safeParse({ answer: "An explanation", followUpQuestions: [] }).success).toBe(true);
    expect(learnResponseSchema.safeParse({ answer: "OK", followUpQuestions: ["x", "y", "z", "extra"] }).success).toBe(false);
  });

  it("selects only bounded recent context while preserving order", () => {
    const history = [
      { role: "user" as const, content: "old" },
      { role: "assistant" as const, content: "older reply" },
      { role: "user" as const, content: "recent question" },
      { role: "assistant" as const, content: "recent reply" },
    ];
    expect(selectRecentContext(history, 2, 30)).toEqual(history.slice(2));
    expect(selectRecentContext(history, 8, 7).map((message) => message.content).join("")).toHaveLength(7);
  });

  it("provides a deterministic valid response with the fake adapter", async () => {
    const reply = await generateLearningReply(new FakeGenerationProvider(), messages, signal());
    expect(reply.answer).toContain("binary trees");
    expect(reply.followUpQuestions.length).toBeGreaterThan(0);
  });

  it.each([
    { name: "Gemini 3.5 Flash-Lite", factory: () => new GeminiGenerationProvider("test-secret", "models/gemini-3.5-flash-lite"), url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", model: "models/gemini-3.5-flash-lite" },
    { name: "Gemini 3.1 Flash-Lite", factory: () => new GeminiGenerationProvider("test-secret", "models/gemini-3.1-flash-lite"), url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", model: "models/gemini-3.1-flash-lite" },
    { name: "Ollama", factory: () => new OllamaGenerationProvider("http://127.0.0.1:11434", "test-model"), url: "http://127.0.0.1:11434/api/chat" },
    { name: "Groq", factory: () => new GroqGenerationProvider("test-secret", "test-model"), url: "https://api.groq.com/openai/v1/chat/completions" },
  ])("uses the shared structured provider contract with $name", async ({ name, factory, url, model }) => {
    const reply = JSON.stringify({ answer: "A short valid explanation.", followUpQuestions: [] });
    const fetchMock = vi.fn(async (input: string | URL | Request, init: RequestInit) => {
      expect(String(input)).toBe(url);
      if (name.startsWith("Gemini")) {
        expect((init.headers as Record<string, string>).authorization).toBe("Bearer test-secret");
        const body = JSON.parse(String(init.body)) as { model: string; response_format: { type: string; json_schema: { strict: boolean; schema: unknown } } };
        expect(body.model).toBe(model);
        expect(body.response_format.type).toBe("json_schema");
        expect(body.response_format.json_schema.strict).toBe(true);
        expect(body.response_format.json_schema.schema).toEqual(learningReplyJsonSchema);
        expect(String(init.body)).not.toContain("test-secret");
        expect(String(input)).not.toContain("test-secret");
      }
      return Response.json(url.includes("127.0.0.1")
        ? { message: { content: reply } }
        : { choices: [{ message: { content: reply } }] });
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const result = await generateLearningReply(factory(), messages, signal());
      expect(result.answer).toBe("A short valid explanation.");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("retries malformed provider output exactly once and then validates", async () => {
    const provider = new FakeGenerationProvider([
      "not json",
      JSON.stringify({ answer: "A tree has nodes and child links.", followUpQuestions: ["Want an example?"] }),
    ]);
    const spy = vi.spyOn(provider, "generate");
    const reply = await generateLearningReply(provider, messages, signal());
    expect(reply.answer).toContain("nodes");
    expect(spy).toHaveBeenCalledTimes(2);
    expect((spy.mock.calls[1][0] as GenerationInput).messages.at(-1)?.content).toContain("previous response");
  });

  it("fails safely after the single malformed-output retry", async () => {
    const provider = new FakeGenerationProvider(["not json", "still not json"]);
    await expect(generateLearningReply(provider, messages, signal())).rejects.toBeInstanceOf(MalformedProviderOutputError);
  });

  it("does not retry provider outages", async () => {
    const generate = vi.fn(async () => { throw new Error("offline"); });
    const provider: GenerationProvider = { generate: generate as (input: GenerationInput) => Promise<string> };
    await expect(generateLearningReply(provider, messages, signal())).rejects.toThrow("offline");
    expect(generate).toHaveBeenCalledTimes(1);
  });
});
