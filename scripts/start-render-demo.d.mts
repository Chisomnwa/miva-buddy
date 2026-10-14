export const RUNTIME_ENV_KEYS: readonly string[];

export function buildChildEnvironment(
  source: Record<string, string | undefined>,
  options?: { web?: boolean; port?: string },
): NodeJS.ProcessEnv;

export function resolvePort(rawPort: string | undefined): string;

export function runRenderDemoSupervisor(options?: {
  spawn?: typeof import("node:child_process").spawn;
  processRef?: NodeJS.Process;
  platform?: NodeJS.Platform;
  env?: Record<string, string | undefined>;
  shutdownGraceMs?: number;
  setTimer?: typeof setTimeout;
  clearTimer?: typeof clearTimeout;
}): Promise<number>;
