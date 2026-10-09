import { interviewPreparationSegmentSchema, type InterviewEvidenceResult } from "@/contracts/interview-evidence";
import { buildInterviewSearchLinks } from "@/lib/interview-search-links";

function evidenceStatus(result: InterviewEvidenceResult | null) {
  if (!result) return null;
  switch (result.state) {
    case "found": return "Qualifying candidate-reported evidence is available.";
    case "no_evidence": return "The permitted search completed, but no qualifying candidate accounts were found.";
    case "failed": return "Candidate accounts could not be checked reliably just now.";
    case "source_not_approved": return "Company-specific candidate accounts are not available in this version; no external source was queried.";
  }
}

function formatDate(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : "date not stated";
}

export function InterviewPreparationCard({ value, id = "standalone" }: { value: unknown; id?: string }) {
  const parsed = interviewPreparationSegmentSchema.safeParse(value);
  if (!parsed.success) return null;
  const prep = parsed.data;
  const titleId = `interview-prep-title-${id}`;
  const searchLinks = prep.requestState === "ready" ? buildInterviewSearchLinks(prep.company, prep.roleTitle) : null;
  return <section className="interview-preparation-card" aria-labelledby={titleId}>
    <p className="interview-preparation-label">INTERVIEW PREPARATION</p>
    <h2 id={titleId}>{prep.requestState === "ready" ? prep.title : "A quick clarification"}</h2>
    {prep.company && <p className="interview-preparation-context">Company: <strong>{prep.company}</strong>{prep.roleTitle ? ` · Role: ${prep.roleTitle}` : ""}{prep.interviewStage ? ` · ${prep.interviewStage}` : ""}</p>}
    <p className="interview-preparation-intro">{prep.introduction}</p>
    {prep.requestState === "ready" && <>
      <p className="interview-evidence-status" role="note">{evidenceStatus(prep.evidence)}</p>
      {prep.evidence?.state === "found" && <div className="interview-evidence-list" aria-label="Candidate-reported interview accounts">
        {prep.evidence.records.map((record) => <article className="interview-evidence-record" key={record.id}>
          <h3>{record.company}{record.role ? ` · ${record.role}` : ""}</h3>
          <p>{record.summary}</p>
          <p className="interview-evidence-dates">Interview: {formatDate(record.interviewEventAt)} · Posted: {formatDate(record.publishedAt)}</p>
          <a href={record.url} target="_blank" rel="noreferrer">{record.attribution} · View original source</a>
        </article>)}
        <p className="interview-anecdotal-note">These individual accounts are anecdotal and may not reflect the company’s current process.</p>
      </div>}
      {searchLinks && <section className="interview-external-searches" aria-labelledby={`${titleId}-searches`}>
        <h3 id={`${titleId}-searches`}>Explore interview experiences</h3>
        <p>Open an external search for discussions about this company and role. Miva Buddy does not fetch or review the results; they are not verified interview evidence.</p>
        <ul>
          <li><a href={searchLinks.hackerNews} target="_blank" rel="noopener noreferrer">Search Hacker News discussions (external)</a></li>
          <li><a href={searchLinks.leetCodeDiscuss} target="_blank" rel="noopener noreferrer">Search LeetCode Discuss (external)</a></li>
        </ul>
      </section>}
      <div className="interview-guidance-block">
        <h3>General guidance—not verified company information</h3>
        <p>These suggestions are based only on the role and interview details you provided. They do not describe the employer’s interview process.</p>
      </div>
      {prep.technicalTopics.length > 0 && <div className="interview-guidance-block"><h3>Topics to review</h3><ul>{prep.technicalTopics.map((topic) => <li key={topic}>{topic}</li>)}</ul></div>}
      {prep.practiceSuggestions.length > 0 && <div className="interview-guidance-block"><h3>Practice suggestions</h3><ul>{prep.practiceSuggestions.map((item) => <li key={item}>{item}</li>)}</ul></div>}
      {prep.behavioralPrompts.length > 0 && <div className="interview-guidance-block"><h3>General mock prompts—not company questions</h3><ul>{prep.behavioralPrompts.map((item) => <li key={item}>{item}</li>)}</ul></div>}
      {prep.studyPlan.length > 0 && <div className="interview-guidance-block"><h3>A short study plan</h3><ol>{prep.studyPlan.map((item) => <li key={item.step}><strong>{item.step}:</strong> {item.task}</li>)}</ol></div>}
    </>}
  </section>;
}
