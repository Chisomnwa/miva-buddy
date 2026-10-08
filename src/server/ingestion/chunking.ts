export type PageText = { pageNumber: number; content: string };
export type MaterialChunk = { ordinal: number; pageStart: number; pageEnd: number; content: string };

const DEFAULT_CHUNK_CHARACTERS = 1_200;
const DEFAULT_OVERLAP_CHARACTERS = 120;

function boundaryBefore(text: string, desiredEnd: number): number {
  const floor = Math.floor(desiredEnd * 0.65);
  const candidates = [text.lastIndexOf("\n", desiredEnd), text.lastIndexOf(" ", desiredEnd)];
  const boundary = Math.max(...candidates);
  return boundary >= floor ? boundary : desiredEnd;
}

export function chunkMaterialPages(
  pages: PageText[],
  options: { maxCharacters?: number; overlapCharacters?: number } = {},
): MaterialChunk[] {
  const maxCharacters = options.maxCharacters ?? DEFAULT_CHUNK_CHARACTERS;
  const overlapCharacters = options.overlapCharacters ?? DEFAULT_OVERLAP_CHARACTERS;
  if (!Number.isInteger(maxCharacters) || maxCharacters < 100
    || !Number.isInteger(overlapCharacters) || overlapCharacters < 0
    || overlapCharacters >= maxCharacters) {
    throw new RangeError("Invalid chunk sizing configuration");
  }

  const chunks: MaterialChunk[] = [];
  for (const page of [...pages].sort((a, b) => a.pageNumber - b.pageNumber)) {
    if (!Number.isInteger(page.pageNumber) || page.pageNumber < 1) {
      throw new RangeError("Page numbers must be positive integers");
    }
    const normalized = page.content.replace(/\s+/g, " ").trim();
    let offset = 0;
    while (offset < normalized.length) {
      let end = Math.min(offset + maxCharacters, normalized.length);
      if (end < normalized.length) end = boundaryBefore(normalized, end);
      const content = normalized.slice(offset, end).trim();
      if (content) {
        chunks.push({
          ordinal: chunks.length,
          pageStart: page.pageNumber,
          pageEnd: page.pageNumber,
          content,
        });
      }
      if (end >= normalized.length) break;
      const next = Math.max(offset + 1, end - overlapCharacters);
      offset = next;
      while (offset < normalized.length && normalized[offset] === " ") offset += 1;
    }
  }
  return chunks;
}
