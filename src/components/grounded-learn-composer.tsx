"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LearnVoiceInput } from "@/components/learn-voice-input";

type GroundedComposerProps = {
  courseId: string;
  materialId: string;
  conceptId: string;
  conversationId?: string;
  suggestions?: string[];
  onIndustryDemonstration?: (value: unknown) => void;
  onIndustryReferences?: (value: unknown) => void;
  onHimalayasReferences?: (value: unknown) => void;
};

function publicError(error: string | undefined) {
  if (error === "rate_limited") return "Please wait a moment before sending another message.";
  if (error === "retrieval_unavailable") return "We couldn't check your course material just now. Your question is saved; please try again shortly.";
  if (error === "provider_unavailable") return "We couldn't prepare an explanation just now. Your question is saved; please try again shortly.";
  return "We couldn't send that question. Please try again.";
}

export function GroundedLearnComposer({ courseId, materialId, conceptId, conversationId, suggestions = [], onIndustryDemonstration, onIndustryReferences, onHimalayasReferences }: GroundedComposerProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = message.trim();
    if (question.length < 2 || pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/learn/grounded", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId, courseId, materialId, conceptId, message: question }),
      });
      const result: { conversationId?: string; error?: string; industryDemonstration?: unknown; industryReferences?: unknown; himalayasReferences?: unknown } = await response.json();
      if (result.conversationId) {
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set("conversationId", result.conversationId);
        if (result.error) {
          setError(publicError(result.error));
          nextUrl.searchParams.set("notice", "retry");
          router.replace(`${nextUrl.pathname}${nextUrl.search}`);
          router.refresh();
          return;
        }
        onIndustryDemonstration?.(result.industryDemonstration ?? null);
        onIndustryReferences?.(result.industryReferences ?? null);
        onHimalayasReferences?.(result.himalayasReferences ?? null);
        setMessage("");
        nextUrl.searchParams.delete("notice");
        router.replace(`${nextUrl.pathname}${nextUrl.search}`);
        router.refresh();
        return;
      }
      setError(publicError(result.error));
    } catch {
      setError("We couldn't send that question. Please check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return <div className="learn-composer-wrap">
    {suggestions.length > 0 && <div className="learn-suggestions" aria-label="Suggested follow-up questions">
      <p className="suggestions-label">Continue learning</p>
      {suggestions.map((suggestion) => <button key={suggestion} className="suggestion-chip" type="button" onClick={() => setMessage(suggestion)}>{suggestion}</button>)}
    </div>}
    <form className="learn-composer" onSubmit={submit}>
      <label className="sr-only" htmlFor="grounded-learn-message">Ask about this concept</label>
      <textarea id="grounded-learn-message" value={message} onChange={(event) => setMessage(event.target.value)}
        placeholder="Ask about this course concept…" maxLength={2_000} rows={3} required minLength={2} disabled={pending} />
      <LearnVoiceInput value={message} disabled={pending} onChange={setMessage} />
      <div className="learn-composer-footer"><span>Up to 2,000 characters</span>
        <button className="button button-primary" type="submit" disabled={pending || message.trim().length < 2}>{pending ? "Thinking…" : "Send"}</button>
      </div>
    </form>
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
