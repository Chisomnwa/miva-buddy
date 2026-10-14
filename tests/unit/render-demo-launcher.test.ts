import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";

const { buildChildEnvironment, resolvePort, runRenderDemoSupervisor } = await import("../../scripts/start-render-demo.mjs");

class FakeChild extends EventEmitter {
  pid: number | undefined;
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  signals: string[] = [];

  kill(signal: string) {
    this.signals.push(signal);
    queueMicrotask(() => {
      this.signalCode = signal as NodeJS.Signals;
      this.emit("exit", null, signal);
    });
    return true;
  }
}

class FakeProcess extends EventEmitter {
  execPath = "/node";
  cwd = () => "/project";
}

function harness() {
  const children: FakeChild[] = [];
  const calls: Array<{ command: string; args: string[]; options: { env: NodeJS.ProcessEnv; detached: boolean } }> = [];
  const processRef = new FakeProcess();
  const spawn = vi.fn((command: string, args: string[], options: { env: NodeJS.ProcessEnv; detached: boolean }) => {
    const child = new FakeChild();
    children.push(child);
    calls.push({ command, args, options });
    return child;
  });
  const setTimer = vi.fn((callback: () => void) => setTimeout(callback, 10_000));
  const clearTimer = vi.fn((timer: ReturnType<typeof setTimeout>) => clearTimeout(timer));
  return { children, calls, processRef, spawn, setTimer, clearTimer };
}

describe("Render demo process launcher", () => {
  it("starts Next on the public port and the worker without public listener settings", async () => {
    const h = harness();
    const run = runRenderDemoSupervisor({
      spawn: h.spawn as never,
      processRef: h.processRef as never,
      platform: "linux",
      env: { PORT: "4312", DATABASE_URL: "safe-test-value", NODE_OPTIONS: "--inspect" },
      setTimer: h.setTimer as never,
      clearTimer: h.clearTimer as never,
    });

    expect(h.calls).toHaveLength(2);
    expect(h.calls[0]?.args).toEqual(expect.arrayContaining(["start", "--hostname", "0.0.0.0", "--port", "4312"]));
    expect(h.calls[0]?.options.env).toMatchObject({ PORT: "4312", NODE_ENV: "production", DATABASE_URL: "safe-test-value" });
    expect(h.calls[1]?.args[0]).toBe("--conditions=react-server");
    expect(h.calls[1]?.options.env).not.toHaveProperty("PORT");
    expect(h.calls[1]?.options.env).not.toHaveProperty("NODE_OPTIONS");
    expect(h.calls.every((call) => call.options.detached)).toBe(true);

    h.processRef.emit("SIGTERM");
    await expect(run).resolves.toBe(0);
  });

  it.each([0, 1])("terminates the sibling and fails when child %i exits unexpectedly", async (exitedIndex) => {
    const h = harness();
    const run = runRenderDemoSupervisor({
      spawn: h.spawn as never,
      processRef: h.processRef as never,
      platform: "linux",
      env: { PORT: "3000" },
      setTimer: h.setTimer as never,
      clearTimer: h.clearTimer as never,
    });

    h.children[exitedIndex]!.exitCode = 7;
    h.children[exitedIndex]!.emit("exit", 7, null);
    await expect(run).resolves.toBe(7);
    expect(h.children[1 - exitedIndex]?.signals).toEqual(["SIGTERM"]);
  });

  it("propagates graceful shutdown and removes parent signal handlers", async () => {
    const h = harness();
    const run = runRenderDemoSupervisor({
      spawn: h.spawn as never,
      processRef: h.processRef as never,
      platform: "linux",
      env: { PORT: "3000" },
      setTimer: h.setTimer as never,
      clearTimer: h.clearTimer as never,
    });

    h.processRef.emit("SIGINT");
    await expect(run).resolves.toBe(130);
    expect(h.children.map((child) => child.signals)).toEqual([["SIGINT"], ["SIGINT"]]);
    expect(h.processRef.listenerCount("SIGINT")).toBe(0);
    expect(h.processRef.listenerCount("SIGTERM")).toBe(0);
  });

  it("force-terminates child process groups after the bounded grace period", async () => {
    const h = harness();
    const run = runRenderDemoSupervisor({
      spawn: h.spawn as never,
      processRef: h.processRef as never,
      platform: "linux",
      env: { PORT: "3000" },
      shutdownGraceMs: 1,
    });
    for (const child of h.children) child.kill = vi.fn(() => true);

    h.processRef.emit("SIGTERM");
    await expect(run).resolves.toBe(1);
    for (const child of h.children) expect(child.kill).toHaveBeenCalledWith("SIGKILL");
  });

  it("rejects invalid ports before spawning either process", async () => {
    const h = harness();
    await expect(runRenderDemoSupervisor({
      spawn: h.spawn as never,
      processRef: h.processRef as never,
      env: { PORT: "70000" },
      setTimer: h.setTimer as never,
      clearTimer: h.clearTimer as never,
    })).resolves.toBe(1);
    expect(h.spawn).not.toHaveBeenCalled();
  });

  it("keeps child environments allow-listed and validates port defaults", () => {
    expect(buildChildEnvironment({ DATABASE_URL: "db", SECRET_EXTRA: "secret", PORT: "1234" })).toEqual({
      NODE_ENV: "production",
      DATABASE_URL: "db",
    });
    expect(resolvePort(undefined)).toBe("3000");
    expect(resolvePort("10000")).toBe("10000");
    expect(() => resolvePort("0")).toThrow("Invalid public port");
  });
});
