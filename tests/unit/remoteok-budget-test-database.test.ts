import { describe, expect, it } from "vitest";
import { parseRemoteOkBudgetTestDatabaseUrl } from "../integration/remoteok-budget-test-database";

describe("Remote OK integration database URL validation", () => {
  it.each([
    "postgres://localuser@127.0.0.1:55432/miva_buddy_remoteok_budget_test",
    "postgresql://localuser@localhost:55432/miva_buddy_remoteok_budget_test",
    "postgresql://localuser@[::1]:55432/miva_buddy_remoteok_budget_test",
  ])("accepts explicit loopback PostgreSQL configuration: %s", (url) => {
    expect(parseRemoteOkBudgetTestDatabaseUrl(url)).toMatchObject({
      host: expect.stringMatching(/^(localhost|127\.0\.0\.1|::1)$/u),
      port: 55_432,
      database: "miva_buddy_remoteok_budget_test",
      user: "localuser",
    });
  });

  it.each([
    undefined,
    "",
    "https://localuser@127.0.0.1:55432/miva_buddy_remoteok_budget_test",
    "postgresql://localuser@db.example.test:55432/miva_buddy_remoteok_budget_test",
    "postgresql://localuser@127.0.0.1/miva_buddy_remoteok_budget_test",
    "postgresql://@127.0.0.1:55432/miva_buddy_remoteok_budget_test",
    "postgresql://localuser@127.0.0.1:70000/miva_buddy_remoteok_budget_test",
    "postgresql://localuser@127.0.0.1:55432/another_database",
    "postgresql://localuser@127.0.0.1:55432/miva_buddy_remoteok_budget_test?host=db.example.test",
    "postgresql://localuser@127.0.0.1:55432/miva_buddy_remoteok_budget_test?sslmode=require",
    "postgresql://localuser@127.0.0.1:55432/miva_buddy_remoteok_budget_test?",
    "postgresql://localuser@127.0.0.1:55432/miva_buddy_remoteok_budget_test#fragment",
    "postgresql://localuser@127.0.0.1:55432/miva_buddy_remoteok_budget_test#",
    "postgresql://local%ZZuser@127.0.0.1:55432/miva_buddy_remoteok_budget_test",
  ])("rejects missing or unsafe database configuration: %s", (url) => {
    expect(parseRemoteOkBudgetTestDatabaseUrl(url)).toBeNull();
  });
});
