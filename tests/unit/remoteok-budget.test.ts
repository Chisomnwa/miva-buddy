import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";

const { getDatabasePool } = vi.hoisted(() => ({ getDatabasePool: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/server/persistence/pool", () => ({ getDatabasePool }));

import { REMOTE_OK_DAILY_REQUEST_LIMIT, reserveRemoteOkDailyRequest } from "@/server/job-evidence/remoteok-budget";

describe("Remote OK shared daily budget adapter", () => {
  beforeEach(() => vi.resetAllMocks());

  it("uses the single four-request limit and reserves through the database function", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ reserved: true }] });
    getDatabasePool.mockReturnValue({ query });

    await expect(reserveRemoteOkDailyRequest()).resolves.toBe("reserved");
    expect(REMOTE_OK_DAILY_REQUEST_LIMIT).toBe(4);
    expect(query).toHaveBeenCalledWith(
      "select public.reserve_remoteok_request_budget($1) as reserved",
      [4],
    );
  });

  it("maps an exhausted reservation without exposing database details", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ reserved: false }] });
    getDatabasePool.mockReturnValue({ query });

    await expect(reserveRemoteOkDailyRequest()).resolves.toBe("exhausted");
  });

  it("treats an unexpected database response as unavailable rather than exhausted", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    getDatabasePool.mockReturnValue({ query });

    await expect(reserveRemoteOkDailyRequest()).resolves.toBe("unavailable");
  });

  it("fails closed when the database connection or reservation fails", async () => {
    const query = vi.fn().mockRejectedValue(new Error("synthetic connection detail"));
    getDatabasePool.mockReturnValue({ query } as unknown as Pool);

    await expect(reserveRemoteOkDailyRequest()).resolves.toBe("unavailable");
  });

  it("fails closed when the shared database pool cannot be configured", async () => {
    getDatabasePool.mockImplementation(() => { throw new Error("synthetic configuration detail"); });

    await expect(reserveRemoteOkDailyRequest()).resolves.toBe("unavailable");
  });
});
