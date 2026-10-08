"use client";

import Link from "next/link";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="recovery-screen" role="alert">
    <section className="recovery-card">
      <p className="eyebrow">A TEMPORARY ISSUE</p>
      <h1>We couldn’t load this part of Miva Buddy.</h1>
      <p className="intro-copy">Your saved learning should still be here. Try again, or return to Home.</p>
      <div className="recovery-actions">
        <button className="button button-primary" onClick={reset}>Try again</button>
        <Link className="button button-secondary" href="/home">Go to Home</Link>
      </div>
    </section>
  </main>;
}
