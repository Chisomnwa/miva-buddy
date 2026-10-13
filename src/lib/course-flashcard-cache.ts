import type { CourseFlashcardsResponse } from "@/contracts/course-flashcards";
import { normalizeCourseFlashcardsResponse } from "@/lib/course-flashcard-display";

export type FlashcardCacheStorage = Pick<Storage, "getItem" | "setItem">;

export function courseFlashcardCacheKey(input: {
  userId: string;
  courseId: string;
  materialId: string;
  conceptId: string;
  sourceVersion: string;
}) {
  return `miva-buddy:flashcards:${JSON.stringify([
    input.userId, input.courseId, input.materialId, input.conceptId, input.sourceVersion,
  ])}`;
}

export function readCourseFlashcardCache(storage: FlashcardCacheStorage, key: string): CourseFlashcardsResponse | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const normalized = normalizeCourseFlashcardsResponse(JSON.parse(raw));
    if (normalized) storage.setItem(key, JSON.stringify(normalized));
    return normalized;
  } catch {
    return null;
  }
}

export function writeCourseFlashcardCache(storage: FlashcardCacheStorage, key: string, value: CourseFlashcardsResponse) {
  try {
    const normalized = normalizeCourseFlashcardsResponse(value);
    if (normalized) storage.setItem(key, JSON.stringify(normalized));
  } catch {
    // Storage can be disabled or full; the in-memory deck remains usable.
  }
}
