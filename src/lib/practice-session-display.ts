export type PracticeSessionDisplay = { id: string; problem_slug: string; status: string };

export function latestPracticeStateByProblem(sessions: PracticeSessionDisplay[]) {
  const latest = new Map<string, { id: string; status: string }>();
  for (const session of sessions) {
    const existing = latest.get(session.problem_slug);
    if (!existing || (existing.status !== "in_progress" && session.status === "in_progress")) {
      latest.set(session.problem_slug, { id: session.id, status: session.status });
    }
  }
  return latest;
}
