import { spawn as nodeSpawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

// Keep child environments small and explicit. In particular, PORT is passed to
// Next only; the worker has no public listener and must not inherit it.
export const RUNTIME_ENV_KEYS = Object.freeze([
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "DATABASE_URL",
  "AI_PROVIDER",
  "OLLAMA_BASE_URL",
  "OLLAMA_MODEL",
  "EMBEDDING_PROVIDER",
  "OLLAMA_EMBEDDING_MODEL",
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "GEMINI_EMBEDDING_MODEL",
  "GEMINI_INTERACTIVE_USER_DAILY_USAGE_UNITS",
  "GEMINI_BACKGROUND_USER_DAILY_USAGE_UNITS",
  "GEMINI_INTERACTIVE_APP_DAILY_USAGE_UNITS",
  "GEMINI_BACKGROUND_APP_DAILY_USAGE_UNITS",
  "GEMINI_TOTAL_APP_DAILY_USAGE_UNITS",
  "GEMINI_MAX_IN_FLIGHT_REQUESTS",
  "COURSE_MATERIAL_DAILY_COUNT_LIMIT",
  "COURSE_MATERIAL_DAILY_BYTES_LIMIT",
  "COURSE_MATERIAL_MANUAL_RETRY_LIMIT",
  "GROQ_API_KEY",
  "GROQ_MODEL",
  "HIMALAYAS_METADATA_ENABLED",
  "REMOTEOK_METADATA_PILOT",
]);

export function buildChildEnvironment(source, { web = false, port = "3000" } = {}) {
  const env = { NODE_ENV: "production" };
  for (const key of RUNTIME_ENV_KEYS) {
    if (typeof source[key] === "string") env[key] = source[key];
  }
  if (web) env.PORT = port;
  return env;
}

export function resolvePort(rawPort) {
  if (rawPort === undefined || rawPort === "") return "3000";
  if (!/^\d{1,5}$/.test(rawPort)) throw new Error("Invalid public port");
  const port = Number(rawPort);
  if (port < 1 || port > 65535) throw new Error("Invalid public port");
  return String(port);
}

function signalProcess(child, signal, platform) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  try {
    if (platform !== "win32" && Number.isInteger(child.pid)) process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch {
    // A process may exit between the state check and signal delivery.
  }
}

function statusForExit(code, signal) {
  if (Number.isInteger(code)) return code === 0 ? 1 : code;
  const signalNumbers = { SIGINT: 2, SIGTERM: 15, SIGKILL: 9 };
  return signal && signalNumbers[signal] ? 128 + signalNumbers[signal] : 1;
}

export async function runRenderDemoSupervisor({
  spawn = nodeSpawn,
  processRef = process,
  platform = process.platform,
  env = process.env,
  shutdownGraceMs = 25_000,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  let port;
  try {
    port = resolvePort(env.PORT);
  } catch {
    console.error("Render demo launcher stopped safely: invalid public port configuration");
    return 1;
  }

  let nextCli;
  try {
    nextCli = require.resolve("next/dist/bin/next");
  } catch {
    console.error("Render demo launcher stopped safely: Next.js runtime executable is unavailable");
    return 1;
  }
  const workerBundle = fileURLToPath(new URL("../.next/worker/worker.mjs", import.meta.url));
  const specs = [
    {
      name: "web",
      command: processRef.execPath,
      args: [nextCli, "start", "--hostname", "0.0.0.0", "--port", port],
      env: buildChildEnvironment(env, { web: true, port }),
    },
    {
      name: "worker",
      command: processRef.execPath,
      args: ["--conditions=react-server", workerBundle],
      env: buildChildEnvironment(env),
    },
  ];

  const children = new Map();
  let stopping = false;
  let shutdownTimer;
  let resolveResult;
  let exitStatus = 0;
  const finished = new Promise((resolve) => { resolveResult = resolve; });

  const finishWhenExited = () => {
    if (stopping && [...children.values()].every(({ exited }) => exited)) {
      if (shutdownTimer) clearTimer(shutdownTimer);
      resolveResult(exitStatus);
    }
  };

  const beginShutdown = (status, signal = "SIGTERM") => {
    if (stopping) return;
    stopping = true;
    exitStatus = status;
    for (const childInfo of children.values()) {
      if (!childInfo.exited) signalProcess(childInfo.child, signal, platform);
    }
    shutdownTimer = setTimer(() => {
      for (const childInfo of children.values()) {
        if (!childInfo.exited) signalProcess(childInfo.child, "SIGKILL", platform);
      }
      // Do not orphan children if the OS fails to deliver an exit event.
      resolveResult(exitStatus || 1);
    }, shutdownGraceMs);
    finishWhenExited();
  };

  const handleSignal = (signal) => beginShutdown(signal === "SIGINT" ? 130 : 0, signal);
  const onSigint = () => handleSignal("SIGINT");
  const onSigterm = () => handleSignal("SIGTERM");
  processRef.once("SIGINT", onSigint);
  processRef.once("SIGTERM", onSigterm);

  try {
    for (const spec of specs) {
      if (stopping) break;
      const child = spawn(spec.command, spec.args, {
        cwd: processRef.cwd(),
        env: spec.env,
        stdio: "inherit",
        detached: platform !== "win32",
        windowsHide: true,
      });
      const childInfo = { child, exited: false };
      children.set(spec.name, childInfo);
      child.once("exit", (code, signal) => {
        childInfo.exited = true;
        if (!stopping) {
          console.error(`Render demo ${spec.name} process exited unexpectedly`);
          beginShutdown(statusForExit(code, signal));
        }
        finishWhenExited();
      });
      child.once("error", () => {
        childInfo.exited = true;
        if (!stopping) {
          console.error(`Render demo ${spec.name} process could not be started`);
          beginShutdown(1);
        }
        finishWhenExited();
      });
    }
  } catch {
    console.error("Render demo process could not be started");
    beginShutdown(1);
  }

  const result = await finished;
  processRef.removeListener("SIGINT", onSigint);
  processRef.removeListener("SIGTERM", onSigterm);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runRenderDemoSupervisor();
}
