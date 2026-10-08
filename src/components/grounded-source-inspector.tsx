"use client";

import { useRef, useState, type MouseEvent } from "react";
import { getGroundedSourceAction } from "@/app/actions/grounded-source";

export function GroundedSourceInspector({ sourceId, label }: { sourceId: string; label: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [source, setSource] = useState<Awaited<ReturnType<typeof getGroundedSourceAction>>["source"]>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function openSource(event: MouseEvent<HTMLButtonElement>) {
    trigger.current = event.currentTarget;
    setLoading(true);
    setError(null);
    const result = await getGroundedSourceAction(sourceId);
    setLoading(false);
    if (!result.source) {
      setError(result.error ?? "This source isn't available.");
      return;
    }
    setSource(result.source);
    dialog.current?.showModal();
  }

  return <>
    <button className="source-button" type="button" onClick={openSource} disabled={loading}>
      {loading ? "Loading source…" : label}
    </button>
    {error && <span className="source-inline-error" role="status">{error}</span>}
    <dialog className="source-dialog" ref={dialog} aria-labelledby={`source-title-${sourceId}`}
      onClose={() => trigger.current?.focus()}>
      <div className="source-dialog-heading">
        <div><p className="eyebrow">FROM YOUR COURSE MATERIAL</p><h2 id={`source-title-${sourceId}`}>{source?.materialTitle ?? "Source"}</h2></div>
        <button type="button" className="source-close" onClick={() => dialog.current?.close()} aria-label="Close source">×</button>
      </div>
      <p className="source-context">{source?.courseTitle} · {source?.pageLabel}</p>
      <blockquote className="source-passage">{source?.content}</blockquote>
      <button className="button button-primary" type="button" onClick={() => dialog.current?.close()}>Return to learning</button>
    </dialog>
  </>;
}
