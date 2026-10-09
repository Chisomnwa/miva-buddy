"use client";

import { useState } from "react";
import Link from "next/link";

export type PracticeResumeItem = {
  id: string;
  title: string;
  difficulty: string;
  mode: string;
  metadata?: string;
};

const DEFAULT_VISIBLE_COUNT = 3;

export function PracticeResumeSection({
  items,
  heading = "Continue where you left off",
  allTopicsHref,
  className = "practice-resume",
}: {
  items: PracticeResumeItem[];
  heading?: string;
  allTopicsHref?: string;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;

  const visibleItems = expanded ? items : items.slice(0, DEFAULT_VISIBLE_COUNT);
  const hiddenCount = items.length - DEFAULT_VISIBLE_COUNT;

  return <section className={className} aria-labelledby="resume-heading">
    {allTopicsHref ? <div className="section-heading-row">
      <h2 id="resume-heading">{heading}</h2>
      <Link className="text-link" href={allTopicsHref}>All topics</Link>
    </div> : <h2 id="resume-heading">{heading}</h2>}
    <ul className="recent-learning-list" id="practice-resume-list">
      {visibleItems.map((item) => <li key={item.id}>
        <Link href={`/practice/session/${item.id}`}>
          <span>{item.title}<small className="practice-list-meta">{item.metadata ?? `${item.difficulty} · ${item.mode === "coach" ? "Coach" : item.mode === "tutor" ? "Tutor" : "Hands Off"}`}</small></span>
          <span aria-hidden="true">→</span>
        </Link>
      </li>)}
    </ul>
    {items.length > DEFAULT_VISIBLE_COUNT && <button
      className="practice-resume-toggle"
      type="button"
      aria-expanded={expanded}
      aria-controls="practice-resume-list"
      onClick={() => setExpanded((current) => !current)}>
      {expanded ? "Show less" : `Show ${hiddenCount} more question${hiddenCount === 1 ? "" : "s"}`}
    </button>}
  </section>;
}
