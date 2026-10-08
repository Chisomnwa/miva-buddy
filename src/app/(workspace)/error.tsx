"use client";

import Link from "next/link";

export default function WorkspaceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="recovery-card workspace-error" role="alert">
    <p className="eyebrow">YOUR LEARNING SPACE</p>
    <h1>We couldn’t load this page.</h1>
    <p className="intro-copy">Your saved work has not been removed. Try again or return to Home.</p>
    <div className="recovery-actions">
      <button className="button button-primary" onClick={reset}>Try again</button>
      <Link className="button button-secondary" href="/home">Go to Home</Link>
    </div>
  </section>;
}
