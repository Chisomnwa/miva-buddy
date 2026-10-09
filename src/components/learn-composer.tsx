"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LearnVoiceInput } from "@/components/learn-voice-input";

type LearnComposerProps = {
  conversationId?: string;
  suggestions?: string[];
  beforeSuggestions?: ReactNode;
};

function publicError(error: unknown) {
  if (error === "rate_limited") return "Please wait a moment before sending another message.";
  if (error === "request_too_large") return "That message is too long. Please shorten it and try again.";
  if (error === "provider_unavailable" || error === "invalid_provider_response") {
    return "We couldn’t get a response just now. Your question is saved; please try again in a moment.";
  }
  return "We couldn’t send that message. Please try again.";
}

export function LearnComposer({ conversationId, suggestions = [], beforeSuggestions }: LearnComposerProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = message.trim();
    if (question.length < 2 || pending) return;

    const activeController = new AbortController();
    controller.current = activeController;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/learn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId, message: question }),
        signal: activeController.signal,
      });
      const result: { conversationId?: string; error?: string } = await response.json();
      if (result.conversationId) {
        setMessage("");
        const suffix = result.error === "provider_unavailable" || result.error === "invalid_provider_response" ? "?notice=retry" : "";
        router.push(`/learn/${result.conversationId}${suffix}`);
        router.refresh();
        return;
      }
      setError(publicError(result.error));
    } catch {
      if (!activeController.signal.aborted) setError("We couldn’t send that message. Please check your connection and try again.");
    } finally {
      if (!activeController.signal.aborted) setPending(false);
      if (controller.current === activeController) controller.current = null;
    }
  }

  return (
    <div className="learn-composer-wrap">
      {beforeSuggestions}
      {suggestions.length > 0 && (
        <div className="learn-suggestions" aria-label="Suggested questions">
          <p className="suggestions-label">Try a question</p>
          {suggestions.map((suggestion) => (
            <button key={suggestion} className="suggestion-chip" type="button" onClick={() => setMessage(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>
      )}
      <form className="learn-composer" onSubmit={submit}>
        <label className="sr-only" htmlFor="learn-message">Ask a question</label>
        <textarea
          id="learn-message"
          name="message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={conversationId ? "Ask a follow-up question…" : "Teach me binary trees…"}
          maxLength={2_000}
          rows={3}
          required
          minLength={2}
          disabled={pending}
        />
        <LearnVoiceInput value={message} disabled={pending} onChange={setMessage} />
        <div className="learn-composer-footer">
          <span>Up to 2,000 characters</span>
          <button className="button button-primary" type="submit" disabled={pending || message.trim().length < 2}>
            {pending ? "Thinking…" : "Send"}
          </button>
        </div>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
