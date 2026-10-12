import { z } from "zod";

const supabaseProjectUrlSchema = z.string().url().refine((value) => {
  const url = new URL(value);
  return (url.protocol === "https:" || url.protocol === "http:")
    && url.pathname === "/"
    && !url.search
    && !url.hash;
}, "Use the Supabase project URL without a path, query, or fragment.");

const serverConfigSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: supabaseProjectUrlSchema,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  DATABASE_URL: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().url().optional(),
  ),
  AI_PROVIDER: z.enum(["fake", "ollama", "gemini", "groq"]).default("fake"),
  OLLAMA_BASE_URL: z.string().url().default("http://127.0.0.1:11434"),
  OLLAMA_MODEL: z.string().trim().min(1).max(100).default("llama3.1"),
  EMBEDDING_PROVIDER: z.enum(["fake", "ollama", "gemini"]).default("fake"),
  OLLAMA_EMBEDDING_MODEL: z.string().trim().min(1).max(100).default("nomic-embed-text"),
  GEMINI_API_KEY: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().min(1).optional(),
  ),
  GEMINI_MODEL: z.string().trim().min(1).max(100).default("models/gemini-3.5-flash-lite"),
  GEMINI_EMBEDDING_MODEL: z.string().trim().regex(/^[a-zA-Z0-9._-]{1,100}$/).default("gemini-embedding-2"),
  GROQ_API_KEY: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().min(1).optional(),
  ),
  GROQ_MODEL: z.string().trim().min(1).max(100).default("openai/gpt-oss-20b"),
});

export function getServerConfig() {
  return serverConfigSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    AI_PROVIDER: process.env.AI_PROVIDER,
    OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
    OLLAMA_MODEL: process.env.OLLAMA_MODEL,
    EMBEDDING_PROVIDER: process.env.EMBEDDING_PROVIDER,
    OLLAMA_EMBEDDING_MODEL: process.env.OLLAMA_EMBEDDING_MODEL,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    GEMINI_EMBEDDING_MODEL: process.env.GEMINI_EMBEDDING_MODEL,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GROQ_MODEL: process.env.GROQ_MODEL,
  });
}

export function getPublicSupabaseConfig() {
  const result = z
    .object({
      url: supabaseProjectUrlSchema,
      publishableKey: z.string().min(1),
    })
    .safeParse({
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    });

  return result.success ? result.data : null;
}
