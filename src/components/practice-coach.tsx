"use client";

import { useState } from "react";
import { savePracticeModeAction } from "@/app/actions/practice";
import type { PracticeCoachResponse, PracticeMode } from "@/contracts/practice-coaching";

type Message = { id: string; role: "user" | "assistant"; content: string; attempt: string | null; response: PracticeCoachResponse | null };

export function PracticeCoach({ sessionId, initialMode, initialMessages, readOnly = false }: { sessionId: string; initialMode: PracticeMode; initialMessages: Message[]; readOnly?: boolean }) {
  const [mode, setMode] = useState(initialMode);
  const [messages, setMessages] = useState(initialMessages);
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [offerTutor, setOfferTutor] = useState(false);

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !message.trim()) return;
    setBusy(true); setNotice(""); setOfferTutor(false);
    const current = { message: message.trim(), attempt };
    try {
      const response = await fetch("/api/practice/coaching", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, ...current }),
      });
      const result = await response.json();
      if (!response.ok) {
        setNotice(result.message ?? "We couldn’t complete that request. Your message may be saved; please try again.");
        setMessages((existing) => [...existing, { id: crypto.randomUUID(), role: "user", content: current.message, attempt: current.attempt || null, response: null }]);
        return;
      }
      setMessages((existing) => [...existing,
        { id: result.userMessageId ?? crypto.randomUUID(), role: "user", content: current.message, attempt: current.attempt || null, response: null },
        ...(result.response ? [{ id: result.assistantMessageId ?? crypto.randomUUID(), role: "assistant" as const, content: "", attempt: null, response: result.response }] : []),
      ]);
      setMessage(""); setAttempt("");
      if (result.status === "mode_limit") { setNotice(result.message); setOfferTutor(Boolean(result.offerTutorSwitch)); }
    } catch {
      setNotice("We couldn’t reach the coaching service. Please try again.");
    } finally { setBusy(false); }
  }

  async function switchToTutor() {
    setBusy(true);
    try {
      const result = await savePracticeModeAction(sessionId, "tutor");
      if (result.error) setNotice(result.error);
      else { setMode("tutor"); setNotice("Tutor mode is saved. Ask again when you’re ready; a complete answer still requires an explicit request."); setOfferTutor(false); }
    } finally { setBusy(false); }
  }

  return <section className="practice-coach" aria-labelledby="coach-heading">
    <header className="practice-coach-header"><div><p className="eyebrow">PRIVATE TO THIS SESSION</p><h2 id="coach-heading">Coaching</h2></div>
      <label className="practice-mode-inline">Assistance mode <select value={mode} disabled={busy || readOnly} onChange={async (event) => {
        const nextMode = event.target.value as PracticeMode; const previous = mode; setMode(nextMode);
        const result = await savePracticeModeAction(sessionId, nextMode);
        if (result.error) { setMode(previous); setNotice(result.error); }
      }}><option value="hands_off">Hands Off</option><option value="coach">Coach</option><option value="tutor">Tutor</option></select></label>
    </header>
    <p className="learning-disclosure">Hands Off offers observations and reflective questions. Coach can name an idea and diagnose your work. Tutor may explain steps; a complete answer is shown only when you explicitly ask. Miva Buddy does not see your LeetCode editor or submissions.</p>
    <div className="practice-transcript" aria-live="polite" aria-label="Coaching conversation" tabIndex={0}>
      {messages.length === 0 && <p className="practice-empty">Share your reasoning, a short attempt, or the exact error you’re seeing to begin.</p>}
      {messages.map((item) => <article className={`practice-message practice-message-${item.role}`} key={item.id}>
        <strong>{item.role === "user" ? "You" : "Miva Buddy"}</strong>
        {item.role === "user" ? <><p>{item.content}</p>{item.attempt && <pre className="practice-attempt">{item.attempt}</pre>}</> : item.response?.segments.map((segment, index) => <p key={`${item.id}-${index}`} className={`practice-segment practice-segment-${segment.kind}`}>{segment.content}</p>)}
      </article>)}
    </div>
    {!readOnly && notice && <div className="form-error practice-notice" role="status">{notice}{offerTutor && <button className="button button-secondary" type="button" disabled={busy} onClick={switchToTutor}>Switch to Tutor</button>}</div>}
    {!readOnly && <form className="practice-composer" onSubmit={send}>
      <label htmlFor="practice-message">What would you like help with?</label>
      <textarea id="practice-message" value={message} maxLength={2000} required rows={3} onChange={(event) => setMessage(event.target.value)} placeholder="I’m stuck on…" />
      <label htmlFor="practice-attempt">Your attempt or relevant context <span>(optional; up to 6,000 characters)</span></label>
      <textarea id="practice-attempt" value={attempt} maxLength={6000} rows={5} onChange={(event) => setAttempt(event.target.value)} placeholder="Paste only the part you want to discuss. Don’t include private information." />
      <div className="practice-composer-footer"><span>Your message and attempt are sent to the configured AI provider for this reply.</span><button className="button button-primary" type="submit" disabled={busy || !message.trim()}>{busy ? "Thinking…" : "Ask for coaching"}</button></div>
    </form>}
  </section>;
}
