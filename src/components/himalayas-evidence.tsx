import type { JobEvidenceResult } from "@/contracts/job-evidence";

export function HimalayasEvidence({ result }: { result: JobEvidenceResult | null }) {
  if (!result) return null;
  if (result.status === "no_evidence") {
    return <p className="remoteok-status" role="status">The Himalayas search completed but found no current related listings for this course concept. Your lesson is unaffected.</p>;
  }
  if (result.status === "source_not_approved") {
    return <p className="remoteok-status" role="status">Himalayas job discovery wasn’t searched because its source-use gate is not approved. Your lesson is unaffected.</p>;
  }
  if (result.status === "failed") {
    return <p className="remoteok-status" role="status">Himalayas listings are temporarily unavailable or could not be verified as current. Your lesson is unaffected.</p>;
  }
  if (result.status === "rate_limited") {
    return <p className="remoteok-status" role="status">The Himalayas search is paused to respect its request limit. Your lesson is unaffected.</p>;
  }
  if (result.status !== "references_only") return null;

  return <section className="remoteok-evidence" aria-labelledby="himalayas-evidence-title">
    <p className="remoteok-label">HIMALAYAS · RELATED LISTINGS</p>
    <h2 id="himalayas-evidence-title">Related remote roles</h2>
    <p className="remoteok-explainer">These listings matched a keyword grounded in your course material. Descriptions were not checked, so this is not evidence that an employer requires the skill.</p>
    <ul className="remoteok-list">
      {result.items.map((item) => <li className="remoteok-card" key={`${item.providerId}:${item.postingId}`}>
        <h3><a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.title}<span aria-hidden="true"> ↗</span></a></h3>
        <p className="remoteok-company">{item.company}</p>
        <p className="remoteok-source"><a href={item.attributionUrl} target="_blank" rel="noopener noreferrer">Source: Himalayas</a>
          {item.publishedAt ? ` · Published ${item.publishedAt.slice(0, 10)}` : ""} · Retrieved {item.retrievedAt.slice(0, 10)}</p>
        <a className="remoteok-listing-link" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">View listing on Himalayas ↗</a>
      </li>)}
    </ul>
  </section>;
}
