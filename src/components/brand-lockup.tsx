import Link from "next/link";

export function BrandLockup({ linked = false }: { linked?: boolean }) {
  const content = <><span className="brand-symbol" aria-hidden="true" /><span>Miva Buddy</span></>;
  return linked ? <Link className="brand-lockup" href="/home" aria-label="Miva Buddy home">{content}</Link>
    : <div className="brand-lockup">{content}</div>;
}
