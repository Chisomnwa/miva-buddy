import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { flashcardDeckReducer, flashcardErrorMessage, flashcardReducer, GroundedConceptLearningModes } from "@/components/grounded-concept-learning-modes";

vi.mock("@/components/grounded-learn-experience", () => ({
  GroundedLearnExperience: () => <div>Existing grounded conversation and question composer</div>,
}));

const props = {
  conceptTitle: "Object-Oriented Programming",
  messages: [],
  courseId: "course-id",
  materialId: "material-id",
  conceptId: "concept-id",
  userId: "user-id",
  sourceVersion: "source-version",
  suggestions: [],
};

describe("grounded concept learning modes", () => {
  it("keeps Ask questions selected by default and has no hardcoded sample cards", () => {
    const html = renderToStaticMarkup(<GroundedConceptLearningModes {...props} />);

    expect(html).toContain('aria-label="Learning mode"');
    expect(html).toContain('aria-pressed="false" aria-controls="flashcards-panel">Flashcards</button>');
    expect(html).toContain('aria-pressed="true" aria-controls="questions-panel">Ask questions</button>');
    expect(html).toContain("Existing grounded conversation and question composer");
    expect(html).not.toContain("FIFO");
    expect(html).not.toContain("Illustrative prototype only");
    expect(html).toContain("Preparing your flashcards…");
    expect(html).not.toContain("flashcard-sources");
  });

  it("keeps keyboard reveal and card navigation independent from concept navigation", () => {
    const state = { index: 0, showingAnswer: false };
    const second = flashcardReducer(state, { type: "next", cardCount: 3 });
    expect(second).toEqual({ index: 1, showingAnswer: false });
    expect(flashcardReducer(second, { type: "flip" })).toEqual({ index: 1, showingAnswer: true });
    expect(flashcardReducer({ index: 1, showingAnswer: true }, { type: "next", cardCount: 3 }))
      .toEqual({ index: 2, showingAnswer: false });
    expect(flashcardReducer({ index: 0, showingAnswer: false }, { type: "previous", cardCount: 3 }))
      .toEqual({ index: 0, showingAnswer: false });
    expect(flashcardDeckReducer({ status: "ready", result: { cards: [] }, errorCode: null }, { type: "error", errorCode: "rate_limited" }))
      .toEqual({ status: "error", result: null, errorCode: "rate_limited" });
    expect(flashcardDeckReducer({ status: "loading", result: null, errorCode: null }, { type: "stale" }))
      .toEqual({ status: "stale", result: null, errorCode: null });
  });

  it("shows distinct student-friendly messages for rate limits, provider quota, invalid output, and unavailable sources", () => {
    const messages = ["rate_limited", "provider_quota", "invalid_generation", "sources_unavailable"]
      .map((code) => flashcardErrorMessage(code as Parameters<typeof flashcardErrorMessage>[0]));
    expect(new Set(messages).size).toBe(messages.length);
    expect(messages.join(" ")).not.toMatch(/uuid|stack|api key|lecture excerpt/i);
    expect(messages[0]).toMatch(/wait a minute/i);
    expect(messages[1]).toMatch(/usage limit/i);
    expect(messages[2]).toMatch(/verify/i);
    expect(messages[3]).toMatch(/sources/i);
  });

  it("explains generation timeouts and offers a retry path", () => {
    const message = flashcardErrorMessage("generation_timeout");
    expect(message).toMatch(/longer than expected/i);
    expect(message).toMatch(/try again/i);
    expect(message).toMatch(/ask questions/i);
    expect(message).not.toMatch(/timeout|stack|api key/i);
  });
});
