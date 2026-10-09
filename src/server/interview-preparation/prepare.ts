import {
  interviewPreparationSegmentSchema,
  type InterviewPreparationSegment,
} from "@/contracts/interview-evidence";

type PriorInterviewSegment = {
  kind: "interview_preparation";
  requestState: "ready" | "clarification_required";
  company: string | null;
  roleTitle: string | null;
  interviewStage: string | null;
};

const companyStopWords = /\b(?:for|as|tomorrow|today|next|this|on|in|soon|help|please|so)\b/i;
const genericCompanyNames = new Set(["a company", "the company", "a team", "them", "somewhere", "any company"]);

export function isInterviewPreparationIntent(message: string) {
  const normalized = message.toLowerCase();
  return /\binterviews?\b/.test(normalized)
    && /\b(?:prepare|preparation|prep|candidates?|experiences?|rounds?|stages?|mock|questions?|practice|expect|help me|how should i)\b/.test(normalized);
}

function extractCompany(message: string, isClarificationReply: boolean): { company: string | null; ambiguous: boolean } {
  let candidate: string | undefined;
  const interviewPhrase = message.match(/\binterview(?:ing)?\b[^.!?]{0,120}?\b(?:at|with)\s+([^,.!?]+)/i);
  if (interviewPhrase?.[1]) candidate = interviewPhrase[1];
  if (!candidate && isClarificationReply) {
    const answerWithCompany = message.match(/\b(?:at|with)\s+([^,.!?]+)/i);
    if (answerWithCompany?.[1]) candidate = answerWithCompany[1];
  }

  if (!candidate && isClarificationReply && message.trim().length <= 100 && !/\b(?:role|job|intern|engineer|developer|position)\b/i.test(message)) {
    candidate = message.trim();
  }

  if (!candidate) return { company: null, ambiguous: false };
  candidate = candidate.split(companyStopWords)[0]?.trim() ?? "";
  candidate = candidate.replace(/^[\s:—-]+|[\s:—-]+$/g, "");
  if (/\b(?:and|or)\b/i.test(candidate)) return { company: null, ambiguous: true };
  if (candidate.length < 2 || candidate.length > 80 || genericCompanyNames.has(candidate.toLowerCase())) {
    return { company: null, ambiguous: false };
  }
  if (!/^[\p{L}\p{N}][\p{L}\p{N} .&'’()/-]*$/u.test(candidate)) return { company: null, ambiguous: false };
  return { company: candidate, ambiguous: false };
}

function extractRole(message: string, clarificationReply = false) {
  if (clarificationReply) {
    const roleBeforeCompany = message.match(/^\s*(?:i(?:'m| am)\s+)?(?:an?\s+)?(.{2,100}?)\s+(?:at|with)\s+/i)?.[1]?.trim();
    if (roleBeforeCompany && /\b(?:engineer|developer|intern|analyst|scientist|designer|manager|architect)\b/i.test(roleBeforeCompany)) {
      return roleBeforeCompany;
    }
  }
  const roleWords = /\b(?:internship|intern|engineer|developer|analyst|scientist|designer|manager|architect|researcher|consultant)\b/i;
  for (const match of message.matchAll(/\b(?:for|as)\s+(?:(?:a|an|the)\s+)?/gi)) {
    const start = (match.index ?? 0) + match[0].length;
    const role = message.slice(start).split(/\s+(?:at|with|for|and|help|please|interview|so)\b|[,!?;.]|$/i)[0]?.trim();
    if (role && role.length <= 100 && !/\b(?:interview|preparation|my interview|this role|that role)\b/i.test(role)
      && roleWords.test(role)) return role;
  }
  const beforeInterview = message.match(/\b((?:[\p{L}\p{N}.+#/-]+\s+){0,5}(?:internship|intern|engineer|developer|analyst|scientist|designer|manager|architect|researcher|consultant))\s+interview\b/iu)?.[1]?.trim();
  if (beforeInterview && beforeInterview.length <= 100) return beforeInterview;
  return null;
}

function extractInterviewStage(message: string) {
  const match = message.match(/\b(technical interview|behavioral interview|phone screen|onsite interview|on-site interview|take-home interview|final round|first round|second round|third round|system design interview)\b/i);
  return match?.[1] ?? null;
}

function priorSegment(value: unknown): PriorInterviewSegment | null {
  if (typeof value !== "object" || value === null) return null;
  const segment = value as Partial<PriorInterviewSegment>;
  if (segment.kind !== "interview_preparation" || !["ready", "clarification_required"].includes(segment.requestState ?? "")) return null;
  if (segment.company !== null && typeof segment.company !== "string") return null;
  if (segment.roleTitle !== null && typeof segment.roleTitle !== "string") return null;
  if (segment.interviewStage !== null && typeof segment.interviewStage !== "string") return null;
  return segment as PriorInterviewSegment;
}

export function latestInterviewPreparationSegment(segments: unknown[]): PriorInterviewSegment | null {
  for (const segment of segments) {
    const parsed = priorSegment(segment);
    if (parsed) return parsed;
  }
  return null;
}

function roleFamily(roleTitle: string | null): "backend" | "frontend" | "data" | "machine_learning" | "software" {
  const role = roleTitle?.toLowerCase() ?? "";
  if (/\bbackend|back-end|server|api\b/.test(role)) return "backend";
  if (/\bfrontend|front-end|ui|web developer\b/.test(role)) return "frontend";
  if (/\bdata|analytics|database\b/.test(role)) return "data";
  if (/\bmachine learning|ml engineer|artificial intelligence| ai\b/.test(role)) return "machine_learning";
  return "software";
}

const topicsByFamily = {
  backend: ["Data structures and problem solving in your strongest language", "HTTP, API design, request validation, and error handling", "SQL fundamentals, data modeling, and indexes", "Testing, debugging, and reasoning about edge cases"],
  frontend: ["JavaScript or TypeScript fundamentals and asynchronous code", "Component state, data flow, and browser behavior", "Semantic HTML, accessibility, and responsive UI basics", "Testing, debugging, and edge cases"],
  data: ["SQL querying, joins, aggregation, and data modeling", "Python or your stated language fundamentals", "Data quality, validation, and explaining analytical choices", "Testing and debugging data transformations"],
  machine_learning: ["Python and core data-structure problem solving", "Model evaluation, data splits, and common sources of leakage", "Explain a model or data project you personally worked on", "Testing, debugging, and communicating uncertainty"],
  software: ["Data structures and algorithms in your strongest language", "Language fundamentals, testing, and debugging", "Breaking a problem into clear steps and discussing tradeoffs", "Explaining a project you personally built"],
} satisfies Record<ReturnType<typeof roleFamily>, string[]>;

function guidanceFor(message: string, roleTitle: string | null, interviewStage: string | null) {
  const family = roleFamily(roleTitle);
  const topics = [...topicsByFamily[family]];
  const lower = `${message} ${interviewStage ?? ""}`.toLowerCase();
  const coding = /coding|technical|algorithm|problem|mock/.test(lower);
  const behavioral = /behavioral|behavioural|culture|experience|mock/.test(lower);
  const practiceSuggestions = coding
    ? ["Choose one curated LeetCode Easy or Medium problem and explain your assumptions before coding.", "After solving, test an empty input, a boundary case, and a typical case; explain complexity.", "Practice narrating your reasoning and asking clarifying questions before implementation."]
    : ["Choose a relevant curated LeetCode problem and explain your reasoning aloud.", "Review one project and be ready to describe your decisions, tests, and what you would improve."];
  const behavioralPrompts = behavioral || !coding
    ? ["Tell me about a time you worked through a difficult technical problem.", "Describe a project decision you made and what you learned from the result.", "How do you respond when you are unsure or receive feedback?"]
    : ["Prepare one concise example of collaborating through a technical challenge."];
  return {
    technicalTopics: topics,
    practiceSuggestions,
    behavioralPrompts,
    studyPlan: [
      { step: "Review", task: `Refresh the fundamentals most relevant to ${roleTitle ?? "the role you are targeting"}.` },
      { step: "Practice", task: "Work through one problem or role-relevant exercise; explain your reasoning and test edge cases." },
      { step: "Reflect", task: "Rehearse one project story and one example of learning from a challenge." },
    ],
  };
}

export function buildInterviewPreparation(input: {
  message: string;
  previousAssistantSegment?: unknown;
}): InterviewPreparationSegment | null {
  const previous = priorSegment(input.previousAssistantSegment);
  const clarificationReply = previous?.requestState === "clarification_required";
  const activePreparation = previous?.requestState === "ready";
  if (!isInterviewPreparationIntent(input.message) && !clarificationReply && !activePreparation) return null;

  const extracted = extractCompany(input.message, clarificationReply);
  const company = extracted.company ?? (activePreparation ? previous?.company ?? null : null);
  const roleTitle = extractRole(input.message, clarificationReply) ?? previous?.roleTitle ?? null;
  const interviewStage = extractInterviewStage(input.message) ?? previous?.interviewStage ?? null;
  if (!company || extracted.ambiguous) {
    return interviewPreparationSegmentSchema.parse({
      kind: "interview_preparation",
      requestState: "clarification_required",
      company: null,
      roleTitle,
      interviewStage,
      evidence: null,
      title: "Company interview preparation",
      introduction: "Which company is the interview with? You can include the role too, if you know it.",
      technicalTopics: [],
      practiceSuggestions: [],
      behavioralPrompts: [],
      studyPlan: [],
      followUpQuestions: [],
    });
  }

  const guidance = guidanceFor(input.message, roleTitle, interviewStage);
  return interviewPreparationSegmentSchema.parse({
    kind: "interview_preparation",
    requestState: "ready",
    company,
    roleTitle,
    interviewStage,
    evidence: { state: "source_not_approved", source: "hn_algolia" },
    title: "General interview preparation—not company-specific",
    introduction: `This preparation is tailored to the ${roleTitle ?? "role you described"}${interviewStage ? ` and the ${interviewStage} you mentioned` : ""}. No verified candidate interview accounts are available in this version, so this is not information about ${company}’s interview process.`,
    ...guidance,
    followUpQuestions: ["Would you like a mock question for this role?", "Would you like to focus on technical or behavioral practice?"],
  });
}

export function interviewMessageContent(segment: InterviewPreparationSegment) {
  if (segment.requestState === "clarification_required") return segment.introduction;
  return `General interview preparation for ${segment.company}. No verified company-specific candidate accounts are available in this version.`;
}
