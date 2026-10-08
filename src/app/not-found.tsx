import Link from "next/link";

export default function NotFound() {
  return <main className="recovery-screen">
    <section className="recovery-card">
      <p className="eyebrow">PAGE NOT FOUND</p>
      <h1>We couldn’t find that page.</h1>
      <p className="intro-copy">It may have moved, or the link may be out of date.</p>
      <Link className="button button-primary" href="/home">Return to Home</Link>
    </section>
  </main>;
}
