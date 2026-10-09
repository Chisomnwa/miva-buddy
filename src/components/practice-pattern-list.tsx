import Link from "next/link";
import { startPracticeSessionAction } from "@/app/actions/practice";
import { PRACTICE_TOPICS, getPracticeProblemsForTopic } from "@/server/practice/catalog";
import { latestPracticeStateByProblem, type PracticeSessionDisplay } from "@/lib/practice-session-display";

export function PracticePatternList({
  sessions,
  progressAvailable,
}: {
  sessions: PracticeSessionDisplay[];
  progressAvailable: boolean;
}) {
  const latestByProblem = latestPracticeStateByProblem(sessions);

  return <section className="practice-pattern-list" aria-label="DSA patterns">
    {PRACTICE_TOPICS.map((topic) => {
      const problems = getPracticeProblemsForTopic(topic.id);
      const completedCount = progressAvailable
        ? problems.filter((problem) => latestByProblem.get(problem.slug)?.status === "completed").length
        : null;
      const progressPercent = completedCount === null || problems.length === 0
        ? 0
        : Math.round((completedCount / problems.length) * 100);

      return <details className="practice-pattern" key={topic.id}>
        <summary className="practice-pattern-summary">
          <span className="practice-pattern-heading">
            <span className="practice-pattern-title">{topic.label}</span>
            <span className="practice-pattern-count" aria-label={completedCount === null
              ? `Progress unavailable out of ${problems.length} problems`
              : `${completedCount} of ${problems.length} problems completed by you`}>
              {completedCount === null ? `—/${problems.length}` : `${completedCount}/${problems.length}`}
            </span>
            <span className="practice-pattern-progress" role="progressbar"
              aria-label={`${topic.label} self-reported completion`}
              aria-valuemin={0}
              aria-valuemax={problems.length}
              {...(completedCount === null
                ? { "aria-valuetext": "Progress unavailable" }
                : { "aria-valuenow": completedCount, "aria-valuetext": `${completedCount} of ${problems.length} completed` })}>
              <span className="practice-pattern-progress-fill" style={{ width: `${progressPercent}%` }} />
            </span>
          </span>
          <span className="practice-pattern-chevron" aria-hidden="true">⌄</span>
        </summary>
        <div className="practice-pattern-content">
          <p className="practice-pattern-description">{topic.description}</p>
          <div className="practice-problem-table" role="list" aria-label={`${topic.label} curated problems`}>
            <div className="practice-problem-row practice-problem-header" aria-hidden="true">
              <span>Status</span><span>Problem</span><span>Difficulty</span><span className="practice-problem-action-label">Open</span>
            </div>
            {problems.map((problem) => {
              const session = progressAvailable ? latestByProblem.get(problem.slug) : undefined;
              const isCompleted = session?.status === "completed";
              const isInProgress = session?.status === "in_progress";
              const status = !progressAvailable ? "Status unavailable" : isCompleted ? "Completed by you" : isInProgress ? "In progress" : "Not started";
              const rowClassName = `practice-problem-row practice-pattern-problem${isCompleted ? " is-completed" : isInProgress ? " is-in-progress" : ""}`;
              const row = <>
                <span className={`practice-pattern-status${isCompleted ? " practice-pattern-status-complete" : isInProgress ? " practice-pattern-status-active" : ""}`}>
                <span className="practice-pattern-status-icon" aria-hidden="true">{!progressAvailable ? "—" : isCompleted ? "✓" : isInProgress ? "◷" : "○"}</span>
                  {status}
                </span>
                <span className="practice-problem-title">{problem.title}</span>
                <span className={`practice-problem-difficulty difficulty-${problem.difficulty.toLowerCase()}`}>{problem.difficulty}</span>
                <span className="practice-problem-open" aria-hidden="true">→</span>
              </>;

              return <div className={rowClassName} role="listitem" key={problem.id}>
                {isInProgress && session
                  ? <Link className="practice-problem-row-link" href={`/practice/session/${session.id}`} aria-label={`Resume ${problem.title} practice`}>
                    {row}
                  </Link>
                  : <form className="practice-problem-row-form" action={startPracticeSessionAction}>
                    <input type="hidden" name="problemSlug" value={problem.slug} />
                    <input type="hidden" name="topicId" value={topic.id} />
                    <button className="practice-problem-row-button" type="submit" aria-label={`${isCompleted ? "Start another practice session for" : "Start or resume"} ${problem.title}`}>
                      {row}
                    </button>
                  </form>}
              </div>;
            })}
          </div>
        </div>
      </details>;
    })}
  </section>;
}
