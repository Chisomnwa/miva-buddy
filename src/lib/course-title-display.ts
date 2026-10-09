/** Presentation-only normalization for titles that look like imported filename stems. */
export function displayCourseTitle(title: string): string {
  // Preserve user punctuation and code-like names. Only long Title_Case_Word chains
  // are clearly likely to have underscores standing in for spaces.
  if (!/^[\p{Lu}][\p{Ll}]+(?:_[\p{Lu}][\p{Ll}]+){2,}$/u.test(title)) return title;
  return title.replaceAll("_", " ");
}
