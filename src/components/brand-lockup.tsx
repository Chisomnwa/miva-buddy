import Link from "next/link";
import Image from "next/image";

type BrandLockupProps = { linked?: boolean; variant?: "university" | "product" };

export function BrandLockup({ linked = false, variant = "university" }: BrandLockupProps) {
  const content = variant === "product" ? (
    <span aria-label="Miva Buddy" className="brand-product-lockup" role="img">
      <span aria-hidden="true" className="brand-product-symbol" />
      <span aria-hidden="true" className="brand-product-type">
        <span className="brand-product-miva" />
        <span className="brand-product-name">Buddy</span>
      </span>
    </span>
  ) : (
    <Image
      alt="Miva Open University"
      className="brand-wordmark"
      height={497}
      priority
      src="/brand/miva-logo.png"
      width={1920}
    />
  );
  return linked ? <Link className="brand-lockup" href="/home" aria-label="Miva Buddy home">{content}</Link>
    : <div className="brand-lockup">{content}</div>;
}
