import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { interviewEvidenceResultSchema } from "@/contracts/interview-evidence";
import { InterviewPreparationCard } from "@/components/interview-preparation-card";
import { buildInterviewPreparation, isInterviewPreparationIntent, latestInterviewPreparationSegment, recoverPreviousInterviewPreparationSegment } from "@/server/interview-preparation/prepare";

describe("company interview preparation in Learn", () => {
  it("recognizes preparation requests without classifying ordinary Learn questions", () => {
    expect(isInterviewPreparationIntent("I have an interview at Coinbase. Help me prepare." )).toBe(true);
    expect(isInterviewPreparationIntent("I have an onsite interview at Coinbase." )).toBe(true);
    expect(isInterviewPreparationIntent("What have other candidates experienced in interviews at Coinbase?" )).toBe(true);
    expect(isInterviewPreparationIntent("Explain binary search with an example." )).toBe(false);
    expect(isInterviewPreparationIntent("I want to know what interviewing at Coinbase looks like.")).toBe(true);
  });

  it("extracts only the company before a conversational looks-like clause", () => {
    const result = buildInterviewPreparation({ message: "I want to know what interviewing at Coinbase looks like." });
    expect(result).toMatchObject({ requestState: "ready", company: "Coinbase" });
  });

  it("preserves legitimate company names that contain conversational-looking words", () => {
    const result = buildInterviewPreparation({ message: "Prepare for an interview at Looks Like Labs." });
    expect(result?.company).toBe("Looks Like Labs");
  });

  it("preserves Coinbase context and extracts a role from the follow-up wording", () => {
    const firstTurn = buildInterviewPreparation({ message: "I have an onsite interview at Coinbase." });
    expect(firstTurn).toMatchObject({ requestState: "ready", company: "Coinbase", interviewStage: "onsite interview" });

    const followUp = buildInterviewPreparation({
      message: "It's a software engineering internship role.",
      previousAssistantSegment: firstTurn,
    });
    expect(followUp).toMatchObject({
      requestState: "ready",
      company: "Coinbase",
      roleTitle: "software engineering internship",
      interviewStage: "onsite interview",
    });
  });

  it("recovers company context when an older assistant reply has no interview segment", () => {
    const recovered = recoverPreviousInterviewPreparationSegment([], [
      "I have an onsite interview at Coinbase.",
      "It's a software engineering internship role.",
    ]);
    expect(recovered).toMatchObject({ company: "Coinbase", roleTitle: "software engineering internship" });
  });

  it("repairs stale structured company metadata from the saved conversation's user turns", () => {
    const original = buildInterviewPreparation({ message: "I have an onsite interview at coinbase." })!;
    const staleSegment = { ...original, company: "Coinbase looks like" };
    const recovered = recoverPreviousInterviewPreparationSegment([staleSegment], [
      "I have an onsite interview at coinbase.",
      "It's a software engineering internship role.",
      "I want to know what interviewing at Coinbase looks like.",
    ]);

    expect(recovered).toMatchObject({
      company: "Coinbase",
      roleTitle: "software engineering internship",
      interviewStage: "onsite interview",
    });
  });

  it("extracts the explicitly stated company, role, and interview stage", () => {
    const result = buildInterviewPreparation({ message: "I have a technical interview at Coinbase for a backend engineering internship. Help me prepare." });
    expect(result).toMatchObject({
      requestState: "ready",
      company: "Coinbase",
      roleTitle: "backend engineering internship",
      interviewStage: "technical interview",
      evidence: { state: "source_not_approved", source: "hn_algolia" },
    });
    expect(result?.technicalTopics).toContain("HTTP, API design, request validation, and error handling");
  });

  it("asks for the company only when missing or ambiguous, then accepts the clarification", () => {
    const missing = buildInterviewPreparation({ message: "Help me prepare for an interview for a backend internship." });
    expect(missing?.requestState).toBe("clarification_required");
    expect(missing?.evidence).toBeNull();

    const ambiguous = buildInterviewPreparation({ message: "Help me prepare for an interview with Google or Microsoft." });
    expect(ambiguous?.requestState).toBe("clarification_required");

    const clarified = buildInterviewPreparation({
      message: "Coinbase",
      previousAssistantSegment: missing,
    });
    expect(clarified).toMatchObject({ requestState: "ready", company: "Coinbase", roleTitle: "backend internship" });
  });

  it("keeps a preparation conversation in generic mode on follow-up", () => {
    const initial = buildInterviewPreparation({ message: "Prepare me for a frontend engineer interview at Shopify." });
    const followUp = buildInterviewPreparation({
      message: "Give me a mock question for this role.",
      previousAssistantSegment: initial,
    });
    expect(followUp).toMatchObject({ requestState: "ready", company: "Shopify", roleTitle: "frontend engineer" });
    expect(followUp?.behavioralPrompts.join(" ")).toContain("difficult technical problem");
  });

  it("labels preparation as generic and makes no unsupported employer-process claim", () => {
    const result = buildInterviewPreparation({ message: "I have an interview at Coinbase for a backend engineering internship. Help me prepare." });
    expect(result?.title).toContain("not company-specific");
    expect(result?.introduction).toContain("not information about Coinbase’s interview process");
    const guidance = JSON.stringify(result);
    expect(guidance).not.toMatch(/Coinbase\s+(?:uses|asks|has|includes)\b/i);
    expect(result?.practiceSuggestions.join(" ")).toContain("LeetCode");
    expect(result?.studyPlan).toHaveLength(3);
  });

  it("renders a full, accessible disclosure with normalized context and grouped guidance", () => {
    const firstTurn = buildInterviewPreparation({ message: "I have an onsite interview at Coinbase." });
    const result = buildInterviewPreparation({
      message: "It's a software engineering internship role.",
      previousAssistantSegment: firstTurn,
    });
    const html = renderToStaticMarkup(<InterviewPreparationCard value={result} id="coinbase" />);
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-controls="interview-prep-content-coinbase"');
    expect(html).toContain("General interview preparation</h2>");
    expect(html).toContain("Company: <strong>Coinbase</strong>");
    expect(html).toContain("Role: <strong>Software Engineering Internship</strong>");
    expect(html).toContain("Stage: <strong>On-site interview</strong>");
    expect(html).toContain("This preparation is tailored to the software engineering internship and the on-site interview you mentioned.");
    expect(html).not.toContain("no external source was queried");
    expect(html).toContain("General guidance — not verified company information");
    expect(html).toContain("These suggestions are based only on the role and interview details you provided. They do not describe the employer&#x27;s interview process.");
    expect((html.match(/class="interview-guidance-block"/g) ?? [])).toHaveLength(1);
    expect(html).toContain("Topics to review");
    expect(html).toContain("Practice suggestions");
    expect(html).toContain("General mock prompts — not company questions");
    expect(html).toContain("A short study plan");
  });

  it("validates the four evidence states as distinct outcomes", () => {
    const found = {
      state: "found", records: [{
        id: "hn-1", source: "Hacker News", sourceItemId: "123", company: "Example Co", role: null,
        attribution: "Hacker News", url: "https://news.ycombinator.com/item?id=123",
        interviewEventAt: null, publishedAt: "2026-10-01T12:00:00.000Z", retrievedAt: "2026-10-09T12:00:00.000Z",
        summary: "A candidate shared a personal interview account.",
      }],
    };
    expect(interviewEvidenceResultSchema.safeParse(found).success).toBe(true);
    expect(interviewEvidenceResultSchema.safeParse({ state: "no_evidence" }).success).toBe(true);
    expect(interviewEvidenceResultSchema.safeParse({ state: "failed", reason: "timeout" }).success).toBe(true);
    expect(interviewEvidenceResultSchema.safeParse({ state: "source_not_approved", source: "hn_algolia" }).success).toBe(true);
    expect(interviewEvidenceResultSchema.safeParse({ state: "found", records: [] }).success).toBe(false);
  });

  it("renders distinct, honest evidence status copy", () => {
    const base = buildInterviewPreparation({ message: "Prepare for an interview at Coinbase." });
    const statusCopies = ["no_evidence", "failed", "source_not_approved"].map((state) => {
      const segment = { ...base, evidence: state === "failed" ? { state, reason: "timeout" } : state === "no_evidence" ? { state } : { state, source: "hn_algolia" } };
      return renderToStaticMarkup(<InterviewPreparationCard value={segment} />);
    });
    expect(statusCopies[0]).toContain("permitted search completed");
    expect(statusCopies[1]).toContain("could not be checked reliably");
    expect(statusCopies[2]).not.toContain("no external source was queried");
  });

  it("persists clarification mode in the structured assistant segment for the next turn", () => {
    const clarification = buildInterviewPreparation({ message: "Help me prepare for an interview." });
    const resumed = latestInterviewPreparationSegment([clarification]);
    expect(resumed?.requestState).toBe("clarification_required");
    expect(buildInterviewPreparation({ message: "Microsoft", previousAssistantSegment: resumed })?.company).toBe("Microsoft");
  });
});
