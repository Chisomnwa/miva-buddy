export const expectedMigrationTags: readonly string[];

export class LocalMigrationSafetyError extends Error {
  readonly category: string;

  constructor(category: string);
}

export function formatLocalMigrationFailure(error: unknown, stage: string): string;

export function parseLocalSupabaseConfig(configText: string): {
  projectId: string;
  databasePort: number;
};

export function validateLocalSupabaseStatus(
  status: unknown,
  localConfig: { projectId: string; databasePort: number },
): string;

export function validateLocalDockerIdentity(
  containers: unknown,
  localConfig: { projectId: string; databasePort: number },
  databaseUrl: string,
): true;

export function parseLocalDockerPsOutput(output: string): unknown[];

export function validateLocalDockerContextHost(output: string): true;

export function validateDrizzleMigrationChain(
  journal: unknown,
  sqlFilenames: string[],
): readonly string[];

export function createDrizzleEnvironment(
  parentEnvironment: Record<string, string | undefined>,
  databaseUrl: string,
): Record<string, string>;
