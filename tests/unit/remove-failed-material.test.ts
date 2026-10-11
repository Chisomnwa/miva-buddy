import { describe, expect, it, vi } from "vitest";
import type { Pool, PoolClient } from "pg";
import { removeFailedMaterial } from "@/server/courses/remove-failed-material";

vi.mock("server-only", () => ({}));

function setup(options: { row?: { kind: string; storage_path: string | null }; deleteCount?: number } = {}) {
  const statements: Array<{ sql: string; values?: unknown[] }> = [];
  const client = {
    query: vi.fn(async (sql: string, values?: unknown[]) => {
      statements.push({ sql, values });
      if (sql.includes("select kind, storage_path")) return { rows: options.row ? [options.row] : [], rowCount: options.row ? 1 : 0 };
      if (sql.includes("delete from public.course_materials")) return { rows: [], rowCount: options.deleteCount ?? 1 };
      return { rows: [], rowCount: 1 };
    }),
    release: vi.fn(),
  } as unknown as PoolClient;
  const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
  return { client, pool, statements };
}

describe("owner-scoped failed material removal", () => {
  const input = { materialId: "material-id", courseId: "course-id", userId: "owner-id" };

  it("removes only a failed owner's PDF, then deletes its row in the same locked transaction", async () => {
    const { client, pool, statements } = setup({ row: { kind: "pdf", storage_path: "owner/course/material/file.pdf" } });
    const removeObject = vi.fn().mockResolvedValue(true);

    await expect(removeFailedMaterial(pool, input, removeObject)).resolves.toBe("removed");
    expect(removeObject).toHaveBeenCalledWith("owner/course/material/file.pdf");
    expect(statements.map(({ sql }) => sql.trim().split(/\s+/u)[0]?.toLowerCase())).toEqual(["begin", "select", "delete", "commit"]);
    expect(statements[1]?.sql).toContain("user_id = $3 and status = 'failed'");
    expect(statements[1]?.sql).toContain("for update");
    expect(statements[1]?.values).toEqual([input.materialId, input.courseId, input.userId]);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("preserves the row when private storage removal fails", async () => {
    const { pool, statements } = setup({ row: { kind: "pdf", storage_path: "owner/course/material/file.pdf" } });
    await expect(removeFailedMaterial(pool, input, async () => false)).resolves.toBe("storage_failed");
    expect(statements.some(({ sql }) => sql.includes("delete from public.course_materials"))).toBe(false);
    expect(statements.at(-1)?.sql).toBe("rollback");
  });

  it("does not remove a material that is not failed and owned by this student", async () => {
    const { pool } = setup();
    const removeObject = vi.fn();
    await expect(removeFailedMaterial(pool, input, removeObject)).resolves.toBe("not_found");
    expect(removeObject).not.toHaveBeenCalled();
  });

  it("reports partial cleanup if storage was removed but the database row was not", async () => {
    const { pool, statements } = setup({ row: { kind: "pdf", storage_path: "owner/course/material/file.pdf" }, deleteCount: 0 });
    await expect(removeFailedMaterial(pool, input, async () => true)).resolves.toBe("partial_failure");
    expect(statements.at(-1)?.sql).toBe("rollback");
  });

  it("removes a failed notes record without attempting storage deletion", async () => {
    const { pool } = setup({ row: { kind: "notes", storage_path: null } });
    const removeObject = vi.fn();
    await expect(removeFailedMaterial(pool, input, removeObject)).resolves.toBe("removed");
    expect(removeObject).not.toHaveBeenCalled();
  });
});
