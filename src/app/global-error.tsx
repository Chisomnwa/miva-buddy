"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en"><body>
    <main className="recovery-screen" role="alert">
      <section className="recovery-card">
        <p className="eyebrow">A TEMPORARY ISSUE</p>
        <h1>Miva Buddy needs another try.</h1>
        <p className="intro-copy">We couldn’t load the application. Please try again.</p>
        <button className="button button-primary" onClick={reset}>Try again</button>
      </section>
    </main>
  </body></html>;
}
