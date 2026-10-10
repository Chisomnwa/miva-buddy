"use client";

import { useState } from "react";
import { interviewPreparationSegmentSchema, type InterviewEvidenceResult } from "@/contracts/interview-evidence";
import { buildInterviewSearchLinks } from "@/lib/interview-search-links";

function evidenceStatus(result: InterviewEvidenceResult | null) {
  if (!result || result.state === "source_not_approved") return null;
  switch (result.state) {
    case "found": return "Qualifying candidate-reported evidence is available.";
    case "no_evidence": return "The permitted search completed, but no qualifying candidate accounts were found.";
    case "failed": return "Candidate accounts could not be checked reliably just now.";
  }
}

function formatDate(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : "date not stated";
}

function formatDisplayWords(value: string) {
  return value.replace(/\b[\p{L}][\p{L}\p{M}'’.-]*/gu, (word) => `${word[0]?.toLocaleUpperCase()}${word.slice(1)}`);
}

function displayRole(roleTitle: string | null) {
  return roleTitle ? formatDisplayWords(roleTitle) : null;
}

function displayCompany(company: string | null) {
  return company?.replace(/\b[\p{L}][\p{L}\p{M}'’.-]*/gu, (word) =>
    word === word.toLocaleLowerCase() ? `${word[0]?.toLocaleUpperCase()}${word.slice(1)}` : word,
  ) ?? null;
}

function displayStage(interviewStage: string | null) {
  if (!interviewStage) return null;
  if (/^on-?site interview$/i.test(interviewStage.trim())) return "On-site interview";
  return formatDisplayWords(interviewStage);
}

function preparationIntroduction(roleTitle: string | null, interviewStage: string | null) {
  const role = roleTitle?.trim().toLocaleLowerCase();
  const stage = displayStage(interviewStage)?.toLocaleLowerCase();
  if (role && stage) return `This preparation is tailored to the ${role} and the ${stage} you mentioned.`;
  if (role) return `This preparation is tailored to the ${role} you described.`;
  if (stage) return `This preparation is tailored to the ${stage} you mentioned.`;
  return "This is general interview preparation based on the details you shared.";
}

export function InterviewPreparationCard({ value, id = "standalone" }: { value: unknown; id?: string }) {
  const parsed = interviewPreparationSegmentSchema.safeParse(value);
  const [expanded, setExpanded] = useState(true);
  if (!parsed.success) return null;

  const prep = parsed.data;
  const titleId = `interview-prep-title-${id}`;
  const contentId = `interview-prep-content-${id}`;
  const company = displayCompany(prep.company);
  const searchLinks = prep.requestState === "ready" ? buildInterviewSearchLinks(company, prep.roleTitle) : null;
  const role = displayRole(prep.roleTitle);
  const stage = displayStage(prep.interviewStage);
  const status = evidenceStatus(prep.evidence);

  return <section className={`interview-preparation-card${expanded ? " is-expanded" : " is-collapsed"}`} aria-labelledby={titleId}>
    <header className="interview-preparation-header">
      <div className="interview-preparation-heading">
        <p className="interview-preparation-label">INTERVIEW PREPARATION</p>
        <h2 id={titleId}>{prep.requestState === "ready" ? "General interview preparation" : "A quick clarification"}</h2>
        {(company || role || stage) && <p className="interview-preparation-context">
          {company && <span>Company: <strong>{company}</strong></span>}
          {role && <span>Role: <strong>{role}</strong></span>}
          {stage && <span>Stage: <strong>{stage}</strong></span>}
        </p>}
      </div>
      <button
        className="interview-preparation-toggle"
        type="button"
        aria-expanded={expanded}
        aria-controls={contentId}
        aria-label={`${expanded ? "Collapse" : "Expand"} interview preparation`}
        onClick={() => setExpanded((current) => !current)}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="m5 7.5 5 5 5-5" /></svg>
      </button>
    </header>

    <div id={contentId} className="interview-preparation-content" hidden={!expanded}>
      <p className="interview-preparation-intro">{prep.requestState === "ready"
        ? preparationIntroduction(prep.roleTitle, prep.interviewStage)
        : prep.introduction}</p>
      {prep.requestState === "ready" && <>
        {status && <p className="interview-evidence-status" role="note">{status}</p>}
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
          <p>These open external Google searches, not verified candidate accounts. Recent filters page dates, not interview dates; some companies may have no recent results.</p>
          <ul>
            <li><a href={searchLinks.hackerNewsRecent} target="_blank" rel="noopener noreferrer">Search Hacker News — past 24 months (external)</a></li>
            <li><a href={searchLinks.hackerNewsAllDates} target="_blank" rel="noopener noreferrer">Search Hacker News — all dates (external)</a></li>
            <li><a href={searchLinks.leetCodeDiscussRecent} target="_blank" rel="noopener noreferrer">Search LeetCode Discuss — past 24 months (external)</a></li>
            <li><a href={searchLinks.leetCodeDiscussAllDates} target="_blank" rel="noopener noreferrer">Search LeetCode Discuss — all dates (external)</a></li>
          </ul>
        </section>}
        <section className="interview-guidance-block" aria-labelledby={`${titleId}-guidance`}>
          <h3 id={`${titleId}-guidance`}>General guidance — not verified company information</h3>
          <p>These suggestions are based only on the role and interview details you provided. They do not describe the employer&apos;s interview process.</p>
          {prep.technicalTopics.length > 0 && <section className="interview-guidance-subsection">
            <h4>Topics to review</h4><ul>{prep.technicalTopics.map((topic) => <li key={topic}>{topic}</li>)}</ul>
          </section>}
          {prep.practiceSuggestions.length > 0 && <section className="interview-guidance-subsection">
            <h4>Practice suggestions</h4><ul>{prep.practiceSuggestions.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>}
          {prep.behavioralPrompts.length > 0 && <section className="interview-guidance-subsection">
            <h4>General mock prompts — not company questions</h4><ul>{prep.behavioralPrompts.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>}
          {prep.studyPlan.length > 0 && <section className="interview-guidance-subsection">
            <h4>A short study plan</h4><ol>{prep.studyPlan.map((item) => <li key={item.step}><strong>{item.step}:</strong> {item.task}</li>)}</ol>
          </section>}
        </section>
      </>}
    </div>
  </section>;
}
