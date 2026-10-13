"use client";

import { useEffect, useReducer, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { courseFlashcardsErrorSchema, type CourseFlashcardsError, type CourseFlashcardsResponse } from "@/contracts/course-flashcards";
import { GroundedLearnExperience } from "@/components/grounded-learn-experience";
import type { GroundedStoredMessage } from "@/components/grounded-learn-conversation";
import { courseFlashcardCacheKey, readCourseFlashcardCache, writeCourseFlashcardCache } from "@/lib/course-flashcard-cache";
import { normalizeCourseFlashcardsResponse, cleanFlashcardDisplayText } from "@/lib/course-flashcard-display";

type Props = {
  conceptTitle: string;
  messages: GroundedStoredMessage[];
  courseId: string;
  materialId: string;
  conceptId: string;
  userId: string;
  sourceVersion: string;
  conversationId?: string;
  suggestions: string[];
};

type CardState = { index: number; showingAnswer: boolean };
type CardAction = { type: "flip" } | { type: "previous"; cardCount: number } | { type: "next"; cardCount: number };
type DeckState = { status: "idle" | "loading" | "ready" | "empty" | "error" | "stale"; result: CourseFlashcardsResponse | null; errorCode: CourseFlashcardsError | null };
type DeckAction = { type: "loading" } | { type: "success"; result: CourseFlashcardsResponse } | { type: "error"; errorCode: CourseFlashcardsError } | { type: "stale" };

export function flashcardReducer(state: CardState, action: CardAction): CardState {
  if (action.type === "flip") return { ...state, showingAnswer: !state.showingAnswer };
  const lastIndex = Math.max(0, action.cardCount - 1);
  const index = action.type === "previous" ? Math.max(0, state.index - 1) : Math.min(lastIndex, state.index + 1);
  return { index, showingAnswer: false };
}

export function flashcardDeckReducer(_state: DeckState, action: DeckAction): DeckState {
  if (action.type === "loading") return { status: "loading", result: null, errorCode: null };
  if (action.type === "error") return { status: "error", result: null, errorCode: action.errorCode };
  if (action.type === "stale") return { status: "stale", result: null, errorCode: null };
  return action.result.cards.length
    ? { status: "ready", result: action.result, errorCode: null }
    : { status: "empty", result: action.result, errorCode: null };
}

const initialDeckState: DeckState = { status: "idle", result: null, errorCode: null };

export function flashcardErrorMessage(code: CourseFlashcardsError | null): string {
  switch (code) {
    case "rate_limited": return "You have requested flashcards several times recently. Please wait a minute, then try again.";
    case "generation_timeout": return "Creating these flashcards took longer than expected. Please try again, or continue with Ask questions.";
    case "provider_quota": return "The flashcard service has reached a temporary usage limit. Please try again later, or use Ask questions.";
    case "provider_configuration": return "Flashcards are temporarily unavailable. You can still use Ask questions; please try flashcards again later.";
    case "provider_rejected":
    case "invalid_generation": return "We couldn’t verify a safe, lecture-supported flashcard set this time. Please retry or use Ask questions.";
    case "sources_unavailable": return "We couldn’t load this concept’s lecture sources. Please retry in a moment or use Ask questions.";
    case "material_not_ready": return "This course material is still being prepared. Please try again when it is ready.";
    case "not_authenticated": return "Your sign-in session may have expired. Refresh the page and sign in again.";
    case "course_not_found":
    case "concept_not_found": return "This course concept is no longer available. Refresh the course page to continue.";
    case "provider_unavailable":
    case "generation_unavailable": return "The flashcard service is temporarily unavailable. Please retry shortly or use Ask questions.";
    case "unexpected_error": return "Something went wrong while preparing flashcards. Please retry or use Ask questions.";
    default: return "We couldn’t prepare flashcards for this concept. Please retry or use Ask questions.";
  }
}

function highlightPlainText(text: string, terms: string[]): ReactNode[] {
  const uniqueTerms = [...new Set(terms.filter(Boolean))].sort((left, right) => right.length - left.length);
  if (!uniqueTerms.length) return [text];
  const pattern = new RegExp(`(${uniqueTerms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return text.split(pattern).map((part, index) => uniqueTerms.some((term) => term.toLocaleLowerCase("en-US") === part.toLocaleLowerCase("en-US"))
    ? <strong className="flashcard-term" key={`term-${index}`}>{part}</strong>
    : part);
}

function renderCardText(text: string, terms: string[]) {
  text = cleanFlashcardDisplayText(text);
  const fencedParts = text.split(/(```[^\n`]*\n[\s\S]*?```)/g);
  return fencedParts.map((part, blockIndex) => {
    const fenced = /^```([^\n`]*)\n([\s\S]*?)```$/.exec(part);
    if (fenced) return <div className="code-example" key={`code-${blockIndex}`}>
      {fenced[1].trim() && <span className="code-language">{fenced[1].trim()}</span>}
      <pre className="learn-code-block" aria-label="Code example" tabIndex={0}><code>{fenced[2]}</code></pre>
    </div>;
    return part.split(/(`[^`\n]+`)/g).map((inlinePart, inlineIndex) => {
      const inlineCode = /^`([^`]+)`$/.exec(inlinePart);
      if (inlineCode) return <code className="flashcard-inline-code" key={`inline-${blockIndex}-${inlineIndex}`}>{inlineCode[1]}</code>;
      return <span key={`text-${blockIndex}-${inlineIndex}`}>{inlinePart.split("\n").flatMap((line, lineIndex) => [
        ...(lineIndex ? [<br key={`br-${blockIndex}-${inlineIndex}-${lineIndex}`} />] : []),
        ...highlightPlainText(line, terms),
      ])}</span>;
    });
  });
}

function Flashcards({ props, active }: { props: Props; active: boolean }) {
  const [deck, dispatchDeck] = useReducer(flashcardDeckReducer, initialDeckState);
  const [cardState, dispatchCard] = useReducer(flashcardReducer, { index: 0, showingAnswer: false });
  const [retry, setRetry] = useState(0);
  const started = useRef(false);
  const requestController = useRef<AbortController | null>(null);
  const cacheKey = courseFlashcardCacheKey(props);

  useEffect(() => {
    if (!active || started.current) return;
    started.current = true;
    let storage: Storage | null = null;
    try { storage = window.sessionStorage; } catch { /* Storage may be disabled by the browser. */ }
    const cached = storage ? readCourseFlashcardCache(storage, cacheKey) : null;
    if (cached) {
      dispatchDeck({ type: "success", result: cached });
      return;
    }

    dispatchDeck({ type: "loading" });
    const controller = new AbortController();
    requestController.current = controller;
    void fetch("/api/learn/flashcards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseId: props.courseId,
        materialId: props.materialId,
        conceptId: props.conceptId,
        sourceVersion: props.sourceVersion,
      }),
      signal: controller.signal,
    }).then(async (response) => {
      if (response.status === 409) throw new Error("source_changed");
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const errorCode = body && typeof body === "object" && "error" in body
          ? courseFlashcardsErrorSchema.safeParse(body.error)
          : null;
        throw new Error(`api:${errorCode?.success ? errorCode.data : "unexpected_error"}`);
      }
      const normalized = normalizeCourseFlashcardsResponse(body);
      if (!normalized) throw new Error("api:unexpected_error");
      if (controller.signal.aborted) return;
      if (storage) writeCourseFlashcardCache(storage, cacheKey, normalized);
      dispatchDeck({ type: "success", result: normalized });
      dispatchCard({ type: "previous", cardCount: 1 });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      if (error instanceof Error && error.message === "source_changed") {
        dispatchDeck({ type: "stale" });
        return;
      }
      const code = error instanceof Error && error.message.startsWith("api:")
        ? courseFlashcardsErrorSchema.safeParse(error.message.slice(4))
        : null;
      dispatchDeck({ type: "error", errorCode: code?.success ? code.data : "unexpected_error" });
    });
  }, [active, cacheKey, props.conceptId, props.courseId, props.materialId, props.sourceVersion, retry]);

  useEffect(() => () => {
    requestController.current?.abort();
    started.current = false;
  }, []);

  const cards = deck.result?.cards ?? [];
  const card = cards[cardState.index];

  function handleCardKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowLeft" && cardState.index > 0) {
      event.preventDefault();
      dispatchCard({ type: "previous", cardCount: cards.length });
    } else if (event.key === "ArrowRight" && cardState.index < cards.length - 1) {
      event.preventDefault();
      dispatchCard({ type: "next", cardCount: cards.length });
    }
  }

  if (deck.status === "idle" || deck.status === "loading") return <section className="prototype-flashcards" aria-labelledby="prototype-flashcards-title" aria-busy="true">
    <h2 id="prototype-flashcards-title">Preparing your flashcards…</h2>
    <p role="status">Finding source passages and creating cards for {props.conceptTitle}.</p>
  </section>;
  if (deck.status === "error") return <section className="prototype-flashcards" aria-labelledby="prototype-flashcards-title">
    <h2 id="prototype-flashcards-title">Flashcards are unavailable</h2>
    <p role="alert">{flashcardErrorMessage(deck.errorCode)}</p>
    <button className="flashcard-nav-button" type="button" onClick={() => { started.current = false; setRetry((value) => value + 1); }}>Try again</button>
  </section>;
  if (deck.status === "stale") return <section className="prototype-flashcards" aria-labelledby="prototype-flashcards-title">
    <h2 id="prototype-flashcards-title">Course material has changed</h2>
    <p role="status">Refresh this course page to create cards from the latest extracted material.</p>
    <button className="flashcard-nav-button" type="button" onClick={() => window.location.reload()}>Refresh course</button>
  </section>;
  if (!card || deck.status === "empty") return <section className="prototype-flashcards" aria-labelledby="prototype-flashcards-title">
    <h2 id="prototype-flashcards-title">Not enough supported material yet</h2>
    <p role="status">{deck.result?.emptyReason === "no_supported_cards"
      ? "The available lecture passages didn’t support a useful flashcard set for this concept. Try another concept or ask a grounded question."
      : "There isn’t enough ready lecture material for flashcards on this concept yet. Add or process more material, or ask a grounded question."}</p>
  </section>;

  return <section className="prototype-flashcards" aria-labelledby="prototype-flashcards-title">
    <p className="generated-flashcards-notice" role="note">Generated for <strong>{props.conceptTitle}</strong> from your course material and checked against its lecture sources.</p>
    <div className="prototype-flashcards-heading">
      <div><p className="eyebrow">COURSE REVIEW</p><h2 id="prototype-flashcards-title">Review with flashcards</h2></div>
      <p className="flashcard-progress" aria-live="polite">{cardState.index + 1} of {cards.length}</p>
    </div>
    <div className="flashcard-stage">
      <button className="flashcard-flip" type="button" aria-keyshortcuts="ArrowLeft ArrowRight" aria-pressed={cardState.showingAnswer}
        onClick={() => dispatchCard({ type: "flip" })} onKeyDown={handleCardKeyDown}>
        <span className={`flashcard-inner${cardState.showingAnswer ? " is-flipped" : ""}`}>
          <span className={`flashcard-face flashcard-front${cardState.showingAnswer ? "" : " is-visible"}`} aria-hidden={cardState.showingAnswer}>
            <span className="flashcard-face-label">Question</span>
            <span className="flashcard-face-content">{renderCardText(card.question, card.highlightTerms)}</span>
            <span className="flashcard-reveal-hint">Click, tap, or press Enter to reveal answer</span>
          </span>
          <span className={`flashcard-face flashcard-back${cardState.showingAnswer ? " is-visible" : ""}`} aria-hidden={!cardState.showingAnswer}>
            <span className="flashcard-face-label">Answer</span>
            <span className="flashcard-face-content">{renderCardText(card.answer, card.highlightTerms)}</span>
            <span className="flashcard-reveal-hint">Click, tap, or press Enter to show question</span>
          </span>
        </span>
      </button>
    </div>
    <div className="flashcard-navigation" role="group" aria-label="Flashcard navigation">
      <button className="flashcard-nav-button" type="button" onClick={() => dispatchCard({ type: "previous", cardCount: cards.length })} disabled={cardState.index === 0}>Previous</button>
      <button className="flashcard-nav-button" type="button" onClick={() => dispatchCard({ type: "next", cardCount: cards.length })} disabled={cardState.index === cards.length - 1}>Next</button>
    </div>
  </section>;
}

export function GroundedConceptLearningModes(props: Props) {
  const [mode, setMode] = useState<"flashcards" | "questions">("questions");
  const groundedProps = {
    messages: props.messages,
    courseId: props.courseId,
    materialId: props.materialId,
    conceptId: props.conceptId,
    conversationId: props.conversationId,
    suggestions: props.suggestions,
  };

  return <div className="concept-learning-modes">
    <div className="concept-mode-switch" role="group" aria-label="Learning mode">
      <button type="button" className="concept-mode-button" aria-pressed={mode === "flashcards"}
        aria-controls="flashcards-panel" onClick={() => setMode("flashcards")}>Flashcards</button>
      <button type="button" className="concept-mode-button" aria-pressed={mode === "questions"}
        aria-controls="questions-panel" onClick={() => setMode("questions")}>Ask questions</button>
    </div>
    <div id="flashcards-panel" className="concept-mode-panel" hidden={mode !== "flashcards"}>
      <Flashcards key={`${props.userId}:${props.courseId}:${props.materialId}:${props.conceptId}:${props.sourceVersion}`} props={props} active={mode === "flashcards"} />
    </div>
    <div id="questions-panel" className="concept-mode-panel" hidden={mode !== "questions"}>
      <GroundedLearnExperience {...groundedProps} />
    </div>
  </div>;
}
