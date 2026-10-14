import { getServerConfig } from "@/lib/config";

export type WorkerConfigurationFailure =
  | "invalid_configuration"
  | "database_not_configured"
  | "fake_provider_in_production"
  | "generation_provider_not_configured"
  | "embedding_provider_not_configured";

const SAFE_FAILURE_MESSAGES: Record<WorkerConfigurationFailure, string> = {
  invalid_configuration: "Worker configuration is invalid",
  database_not_configured: "Worker database is not configured",
  fake_provider_in_production: "Production worker requires real AI providers",
  generation_provider_not_configured: "Worker generation provider is not configured",
  embedding_provider_not_configured: "Worker embedding provider is not configured",
};

export class WorkerConfigurationError extends Error {
  constructor(readonly category: WorkerConfigurationFailure) {
    super(SAFE_FAILURE_MESSAGES[category]);
    this.name = "WorkerConfigurationError";
  }
}

export function loadWorkerConfig(
  readConfig: typeof getServerConfig = getServerConfig,
  nodeEnv = process.env.NODE_ENV,
) {
  let config: ReturnType<typeof getServerConfig>;
  try {
    config = readConfig();
  } catch {
    throw new WorkerConfigurationError("invalid_configuration");
  }

  if (!config.DATABASE_URL) throw new WorkerConfigurationError("database_not_configured");
  if (nodeEnv === "production" && (config.AI_PROVIDER === "fake" || config.EMBEDDING_PROVIDER === "fake")) {
    throw new WorkerConfigurationError("fake_provider_in_production");
  }
  if ((config.AI_PROVIDER === "gemini" && !config.GEMINI_API_KEY)
    || (config.AI_PROVIDER === "groq" && !config.GROQ_API_KEY)) {
    throw new WorkerConfigurationError("generation_provider_not_configured");
  }
  if (config.EMBEDDING_PROVIDER === "gemini" && !config.GEMINI_API_KEY) {
    throw new WorkerConfigurationError("embedding_provider_not_configured");
  }
  return config;
}
