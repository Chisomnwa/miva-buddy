import type { IndustryDemo } from "@/contracts/industry-demo";

export function IndustryEvidenceCard({ demonstration }: { demonstration: IndustryDemo | null }) {
  if (!demonstration) return null;
  return <aside className="industry-evidence-demo" aria-labelledby="industry-evidence-demo-title">
    <p className="industry-demo-label">{demonstration.label}</p>
    <h2 id="industry-evidence-demo-title">Industry evidence card preview</h2>
    <p className="industry-demo-context">Course text directly mentions <strong>{demonstration.matchedTerm}</strong>. This preview uses synthetic content.</p>
    <article className="industry-demo-posting">
      <h3>{demonstration.title}</h3>
      <p>{demonstration.company}</p>
      <blockquote>{demonstration.excerpt}</blockquote>
    </article>
    <p className="industry-demo-notice" role="note">{demonstration.notice}</p>
  </aside>;
}
