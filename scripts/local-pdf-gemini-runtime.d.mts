export type LocalRuntimeConfig = {
  projectId: string;
  databasePort: number;
  apiPort: number;
};

export function validateLocalApiEndpoint(rawUrl: string, apiPort: number): boolean;
export function assertNoPendingCourseJobs(count: number | undefined): true;
export function buildLocalPdfGeminiEnvironment(args: {
  status: Record<string, unknown>;
  localConfig: LocalRuntimeConfig;
  containers: unknown[];
  sourceEnvironment: Record<string, string | undefined>;
}): NodeJS.ProcessEnv;
