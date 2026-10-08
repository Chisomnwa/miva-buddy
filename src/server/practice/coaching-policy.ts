import { z } from "zod";
import type { PracticeMode, PracticeProblem } from "@/contracts/practice";
import {
  practiceCoachResponseSchema,
  practiceRequestTypeSchema,
  type PracticeCoachResponse,
  type PracticeRequestType,
} from "@/contracts/practice-coaching";
import { MalformedProviderOutputError } from "@/server/ai/provider";

export type PracticePolicyRejectionReason = "output_shape" | "forbidden_segment" | "telemetry_claim" | "ungrounded_reference" | "code_not_allowed" | "answer_not_explicit" | "procedural_content" | "idea_leakage" | "missing_reflection";
export class PracticePolicyRejectionError extends MalformedProviderOutputError {
  constructor(readonly reason: PracticePolicyRejectionReason) { super(); }
}

function reject(reason: PracticePolicyRejectionReason): never { throw new PracticePolicyRejectionError(reason); }

const fullAnswerPatterns = [
  /\b(?:full|complete|entire|whole|working)\s+(?:solution|answer|code|implementation)\b/i,
  /\b(?:final answer|solution code|write the code|give me the code|show me the code|solve it for me)\b/i,
  /\b(?:give|show|write|provide|generate)\s+me\s+(?:the\s+)?(?:full|complete|entire)\b/i,
  /\bjust\s+(?:give|show|write)\s+me\s+(?:the\s+)?answer\b/i,
  /\b(?:show|give|write|provide|generate)\s+(?:me\s+)?(?:a|the)?\s*(?:working\s+)?(?:implementation|solution|answer)\b/i,
  /\b(?:what is|tell me)\s+the\s+(?:answer|solution)\b/i,
  /\b(?:solve|complete|finish)\s+(?:this|the problem)\s+for\s+me\b/i,
];

export function isExplicitFullAnswerRequest(message: string): boolean {
  if (/\b(?:don['’]?t|do not|not|without|no need for|never)\b.{0,45}\b(?:full|complete|entire|working)?\s*(?:solution|answer|code|implementation)\b/i.test(message)) return false;
  return fullAnswerPatterns.some((pattern) => pattern.test(message));
}

export function classifyPracticeRequest(message: string): PracticeRequestType {
  if (isExplicitFullAnswerRequest(message)) return "full_answer";
  if (/\b(?:dry\s*run|trace\s+(?:this|the|my)|walk\s+through\s+(?:this|the|my))\b/i.test(message)) {
    return /\bdry\s*run\b/i.test(message) ? "dry_run" : "walkthrough";
  }
  if (/\b(?:failed?\s+test|expected\s+.+\s+got|actual\s+output|wrong\s+answer)\b/i.test(message)) return "failed_test";
  if (/\b(?:[A-Za-z]*Error|exception|crash|stack\s+trace|doesn't\s+work|does\s+not\s+work)\b/i.test(message)) return "code_error";
  if (/\b(?:my\s+approach|my\s+reasoning|explain\s+my\s+approach)\b/i.test(message)) return "explain_approach";
  if (/\b(?:stuck|hint|nudge)\b/i.test(message)) return "stuck";
  return practiceRequestTypeSchema.parse("other");
}

export function evaluateModeRequest(mode: PracticeMode, message: string) {
  const explicitFullAnswer = isExplicitFullAnswerRequest(message);
  if (!explicitFullAnswer || mode === "tutor") return { allowed: true as const, explicitFullAnswer };
  return {
    allowed: false as const,
    explicitFullAnswer,
    offerTutorSwitch: mode === "coach",
    message: mode === "coach"
      ? "A complete answer is outside Coach mode. You can switch to Tutor, then ask again; your mode will not change automatically."
      : "A complete answer is outside Hands Off mode. Change your mode if you want more direct help, then ask again.",
  };
}

export function allowedSegmentKinds(mode: PracticeMode, explicitFullAnswer: boolean) {
  if (mode === "hands_off") return ["observation", "reflection_question"] as const;
  if (mode === "coach") return ["observation", "reflection_question", "idea", "diagnosis"] as const;
  return explicitFullAnswer
    ? ["observation", "reflection_question", "idea", "diagnosis", "step", "complete_answer"] as const
    : ["observation", "reflection_question", "idea", "diagnosis", "step"] as const;
}

export function practiceCoachJsonSchema(mode: PracticeMode, explicitFullAnswer: boolean) {
  return {
    type: "object", additionalProperties: false, required: ["segments"],
    properties: {
      segments: {
        type: "array", minItems: 1, maxItems: 5,
        items: {
          type: "object", additionalProperties: false,
          required: ["kind", "content", "format", "references"],
          properties: {
            kind: { type: "string", enum: [...allowedSegmentKinds(mode, explicitFullAnswer)] },
            content: { type: "string", minLength: 1, maxLength: 1200 },
            format: { type: "string", enum: ["prose", "code"] },
            references: { type: "array", maxItems: 12, items: {
              type: "string", maxLength: 120,
              pattern: "^(identifier:[A-Za-z_$][\\w$]*|line:[1-9][0-9]*)$",
            } },
          },
        },
      },
    },
  } as const;
}

const knownLeetCodeClaims = /\b(?:i can see|i saw|i noticed you|your latest submission|you just ran|your last run|leetcode (?:accepted|rejected)|accepted by leetcode|your editor shows|you spent \d+ minutes)\b/i;
const directSolutionClaims = /(?:```|\b(?:the|a) (?:full |complete )?solution is\b|\bhere(?:'s| is) (?:the )?(?:full |complete )?(?:solution|code)\b|\breturn\s+(?:the|both|these|their)\s+(?:indices|values)\b)/i;
const proceduralCues = /\b(?:iterate|loop|initialize|create|store|insert|look up|lookup|update|increment|return|compare each|for every|for each|then|after that|start by|begin by|repeat until|step\s+\d|you should use|you can use|first\s+(?:create|store|look|check|compare|initialize|iterate)|next\s+(?:create|store|look|check|compare|initialize|iterate))\b/gi;
const nonTutorAdvice = /\b(?:you should|try using|use a|keep track of|make a|build a|one approach is|the (?:best|correct) approach)\b/i;
const handsOffLeadingHint = /\b(?:track|remember|store|keep|record|look up|lookup|cache|data structure)\b/i;
const codeLikeContent = /(?:\b(?:const|let|var|function|class)\s+[A-Za-z_$][\w$]*|=>|;\s*$|\b(?:if|for|while)\s*\()/i;
const ideaAliases: readonly [string, RegExp][] = [
  ["hash table", /\b(?:hash ?map|hash table|dictionary|complement lookup)\b/i],
  ["two pointers", /\b(?:two[- ]pointer|left and right pointer)\b/i],
  ["binary search", /\bbinary search\b/i],
  ["sliding window", /\bsliding window\b/i],
  ["depth-first search", /\b(?:depth[- ]first search|dfs)\b/i],
  ["breadth-first search", /\b(?:breadth[- ]first search|bfs)\b/i],
  ["dynamic programming", /\bdynamic programming\b/i],
  ["stack", /\bstack\b/i],
  ["recursion", /\brecursion|recursive\b/i],
  ["union find", /\b(?:union[- ]find|disjoint set)\b/i],
  ["sorting", /\b(?:sort|sorting|sorted order)\b/i],
  ["linked list", /\blinked[- ]list\b/i],
  ["prefix sum", /\bprefix sums?\b/i],
  ["greedy", /\bgreedy\b/i],
  ["heap", /\b(?:heap|priority queue)\b/i],
  ["queue", /\bqueue\b/i],
  ["backtracking", /\bbacktracking\b/i],
  ["topological sort", /\btopological sort\b/i],
  ["memoization", /\bmemoization\b/i],
];

function userIdentifiers(input: string) {
  return new Set(input.match(/\b[A-Za-z_$][\w$]*\b/g) ?? []);
}

function referencedIdentifiers(content: string) {
  const results = [...content.matchAll(/`([A-Za-z_$][\w$]*)`/g)].map((match) => match[1]);
  for (const match of content.matchAll(/\b(?:variable|identifier|function|method|parameter)\s+[`'"\[]?([A-Za-z_$][\w$]*)/gi)) {
    results.push(match[1]);
  }
  return results;
}

function validateCandidateReferences(response: PracticeCoachResponse, userInput: string): boolean {
  const identifiers = userIdentifiers(userInput);
  const suppliedLines = userInput.length ? userInput.split("\n").length : 0;
  for (const segment of response.segments) {
    for (const reference of segment.references) {
      if (reference.startsWith("identifier:") && !identifiers.has(reference.slice("identifier:".length))) return false;
      if (reference.startsWith("line:") && Number(reference.slice("line:".length)) > suppliedLines) return false;
    }
    if (segment.format !== "code") {
      for (const identifier of referencedIdentifiers(segment.content)) if (!identifiers.has(identifier)) return false;
    }
    for (const match of segment.content.matchAll(/\b(?:line|lines)\s+(\d+)\b/gi)) {
      if (!suppliedLines || Number(match[1]) > suppliedLines) return false;
    }
  }
  return true;
}

function leaksUnstatedIdea(content: string, mode: PracticeMode, problem: PracticeProblem) {
  if (mode !== "hands_off") return false;
  const knownTags = problem.tags.join(" ").toLocaleLowerCase("en-US");
  return ideaAliases.some(([name, pattern]) => pattern.test(content)
    && (knownTags.includes(name) || pattern.test(`${problem.title} ${problem.tags.join(" ")}`)));
}

export function validatePracticeCandidate(input: {
  raw: string;
  mode: PracticeMode;
  explicitFullAnswer: boolean;
  userInput: string;
  problem: PracticeProblem;
}): PracticeCoachResponse {
  let response: PracticeCoachResponse;
  try {
    response = practiceCoachResponseSchema.parse(JSON.parse(input.raw));
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError) reject("output_shape");
    throw error;
  }
  const allowed = new Set<string>(allowedSegmentKinds(input.mode, input.explicitFullAnswer));
  if (response.segments.some((segment) => !allowed.has(segment.kind))) reject("forbidden_segment");
  if (response.segments.some((segment) => knownLeetCodeClaims.test(segment.content))) reject("telemetry_claim");
  if (!validateCandidateReferences(response, input.userInput)) reject("ungrounded_reference");

  for (const segment of response.segments) {
    if (segment.format === "code" && segment.kind !== "complete_answer") reject("code_not_allowed");
    if (segment.kind === "complete_answer" && (input.mode !== "tutor" || !input.explicitFullAnswer)) reject("answer_not_explicit");
    if (input.mode !== "tutor" && (segment.format === "code" || codeLikeContent.test(segment.content) || directSolutionClaims.test(segment.content))) {
      reject("code_not_allowed");
    }
    if (input.mode !== "tutor" && (proceduralCues.test(segment.content) || nonTutorAdvice.test(segment.content))) {
      proceduralCues.lastIndex = 0;
      reject("procedural_content");
    }
    proceduralCues.lastIndex = 0;
    if (input.mode === "hands_off" && handsOffLeadingHint.test(segment.content)) reject("idea_leakage");
    if (leaksUnstatedIdea(segment.content, input.mode, input.problem)) reject("idea_leakage");
  }
  if (input.mode === "hands_off" && !response.segments.some((segment) => segment.kind === "reflection_question")) {
    reject("missing_reflection");
  }
  return response;
}
