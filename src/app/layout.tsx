import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Miva Buddy — Learn with confidence",
  description: "A calm learning companion for Miva CS and Software Engineering students.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
