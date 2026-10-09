"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLockup } from "@/components/brand-lockup";

const primaryLinks = [
  { href: "/home", label: "Home", icon: "⌂" },
  { href: "/learn", label: "Learn", icon: "↗" },
  { href: "/courses", label: "Courses", icon: "▤" },
  { href: "/practice", label: "Practice", icon: "⌘" },
];

function NavItems() {
  const pathname = usePathname();
  return primaryLinks.map(({ href, label, icon }) => {
    const active = pathname === href || (href !== "/home" && pathname.startsWith(`${href}/`));
    return (
      <Link aria-current={active ? "page" : undefined} className={`nav-link${active ? " is-active" : ""}`} href={href} key={href}>
        <span aria-hidden="true" className="nav-icon">{icon}</span>
        <span>{label}</span>
      </Link>
    );
  });
}

export function AppNavigation() {
  return (
    <>
      <aside className="sidebar" aria-label="Primary navigation">
        <BrandLockup linked />
        <nav className="side-links"><NavItems /></nav>
        <Link className="profile-link" href="/profile">Profile &amp; settings</Link>
      </aside>
      <header className="mobile-header">
        <BrandLockup linked />
        <Link className="mobile-profile" href="/profile" aria-label="Profile and settings">Profile</Link>
      </header>
      <nav className="bottom-nav" aria-label="Primary navigation"><NavItems /></nav>
    </>
  );
}
