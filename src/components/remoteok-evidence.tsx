import type { JobEvidenceResult, JobReference } from "@/contracts/job-evidence";

function retrievedDate(item: JobReference): string {
  return item.retrievedAt.slice(0, 10);
}

export function RemoteOkEvidence({ result }: { result: JobEvidenceResult | null }) {
  if (!result) return null;
  if (result.status === "no_evidence") {
    return <p className="remoteok-status" role="status">The approved job-evidence search completed but found no qualifying matches. Your lesson is unaffected.</p>;
  }
  if (result.status === "source_not_approved") {
    return <p className="remoteok-status" role="status">Job evidence wasn’t searched because the source isn’t approved for this use. Your lesson is unaffected.</p>;
  }
  if (result.status === "failed") {
    return <p className="remoteok-status" role="status">The job-evidence search couldn’t be completed reliably. Your lesson is unaffected.</p>;
  }
  if (result.status === "rate_limited") {
    return <p className="remoteok-status" role="status">The Remote OK lookup is paused to respect its request limit. Your lesson is unaffected.</p>;
  }
  if (result.status === "stale") {
    return <p className="remoteok-status" role="status">The available job evidence is too old to show. Your lesson is unaffected.</p>;
  }
  if (result.status === "removed") {
    return <p className="remoteok-status" role="status">A previously found listing is no longer available. Your lesson is unaffected.</p>;
  }

  if (result.status === "found") {
    return <section className="remoteok-evidence" aria-labelledby="job-evidence-title">
      <p className="remoteok-label">JOB EVIDENCE</p>
      <h2 id="job-evidence-title">Relevant job requirements</h2>
      <ul className="remoteok-list">
        {result.items.map((item) => <li className="remoteok-card" key={`${item.providerId}:${item.postingId}`}>
          <h3><a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.title}<span aria-hidden="true"> ↗</span></a></h3>
          <p className="remoteok-company">{item.company}{item.location ? ` · ${item.location}` : ""}</p>
          <p>Course concept match: {item.matchedTerm}</p>
          <blockquote>{item.excerpt}</blockquote>
          <p className="remoteok-source"><a href={item.attributionUrl} target="_blank" rel="noopener noreferrer">{item.attributionLabel}</a>
            {item.publishedAt ? ` · Listed ${item.publishedAt.slice(0, 10)}` : ""} · Retrieved {item.retrievedAt.slice(0, 10)}</p>
          <a className="remoteok-listing-link" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">View original listing ↗</a>
        </li>)}
      </ul>
    </section>;
  }
  if (result.status !== "references_only") return null;

  return <section className="remoteok-evidence" aria-labelledby="remoteok-evidence-title">
    <p className="remoteok-label">REMOTE OK · METADATA ONLY</p>
    <h2 id="remoteok-evidence-title">Related software roles</h2>
    <p className="remoteok-explainer">Selected using Remote OK’s own tags. Job descriptions were not checked, so no skill requirement is being claimed.</p>
    <ul className="remoteok-list">
      {result.items.map((item) => <li className="remoteok-card" key={`${item.providerId}:${item.postingId}`}>
        <h3><a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.title}<span aria-hidden="true"> ↗</span></a></h3>
        <p className="remoteok-company">{item.company}{item.location ? ` · ${item.location}` : ""}</p>
        {item.matchedTags.length > 0 && <p className="remoteok-tags">Remote OK tag match: {item.matchedTags.join(", ")}</p>}
        {item.tags.length > 0 && <p className="remoteok-tags">Tags: {item.tags.join(", ")}</p>}
        <p className="remoteok-source"><a href={item.attributionUrl} target="_blank" rel="noopener noreferrer">Source: Remote OK</a>
          {item.publishedAt ? ` · Listed ${item.publishedAt.slice(0, 10)}` : ""} · Retrieved {retrievedDate(item)}</p>
        <a className="remoteok-listing-link" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">View original listing on Remote OK ↗</a>
      </li>)}
    </ul>
  </section>;
}
