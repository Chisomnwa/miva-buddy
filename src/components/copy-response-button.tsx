"use client";

import { useEffect, useState } from "react";

export function CopyResponseButton({ content }: { content: string }) {
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Copy response");
  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 0);
    return () => window.clearTimeout(timer);
  }, []);
  async function copy() {
    setStatus("Copying…");
    try {
      await navigator.clipboard.writeText(content);
      setStatus("Copied");
    } catch {
      setStatus("Could not copy");
    }
  }
  return <button className="copy-response" type="button" onClick={copy} disabled={!ready || status === "Copying…"} aria-live="polite">{status}</button>;
}
