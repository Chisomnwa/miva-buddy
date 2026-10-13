import { courseFlashcardsResponseSchema, type CourseFlashcardsResponse } from "@/contracts/course-flashcards";

const uuidLike = String.raw`[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{4,16}`;
const bracketedUuid = new RegExp(String.raw`\[\s*(?:${uuidLike})\s*\]`, "gi");
const bareUuid = new RegExp(String.raw`\b${uuidLike}\b`, "gi");
const structuredCitationToken = /\b(?:citation|source|chunk)(?:[_ -]?ids?)\s*[:=]\s*\[[^\]]*\]/gi;
const prefixedUuid = new RegExp(String.raw`\b(?:source|citation|chunk)(?:[_ -]?id)?\s*[:#=]\s*${uuidLike}`, "gi");
const labeledCitation = /\[(?:source|citation|chunk)(?:[_ -]?id)?\s*[:#=]\s*[^\]]+\]/gi;

/** Remove only explicit source/citation identifiers, preserving ordinary bracketed content such as arrays. */
export function cleanFlashcardDisplayText(text: string): string {
  return text
    .replace(structuredCitationToken, " ")
    .replace(labeledCitation, " ")
    .replace(prefixedUuid, " ")
    .replace(bracketedUuid, " ")
    .replace(bareUuid, " ")
    .replace(/[ \t]+([,.;:!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .trim();
}

/** Accept legacy cached objects, strip their source footers, and normalize leaked IDs before display. */
export function normalizeCourseFlashcardsResponse(value: unknown): CourseFlashcardsResponse | null {
  const parsed = courseFlashcardsResponseSchema.safeParse(value);
  if (!parsed.success || parsed.data.cards.length > 12) return null;
  const normalized = {
    ...parsed.data,
    cards: parsed.data.cards.map((card) => {
      const question = cleanFlashcardDisplayText(card.question);
      const answer = cleanFlashcardDisplayText(card.answer);
      const visibleText = `${question}\n${answer}`.toLocaleLowerCase("en-US");
      return {
        question,
        answer,
        highlightTerms: card.highlightTerms.filter((term) => visibleText.includes(term.toLocaleLowerCase("en-US"))),
      };
    }),
  };
  return courseFlashcardsResponseSchema.safeParse(normalized).success
    ? courseFlashcardsResponseSchema.parse(normalized)
    : null;
}
