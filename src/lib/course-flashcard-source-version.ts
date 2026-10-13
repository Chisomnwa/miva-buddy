/** Stable client cache token; source chunk IDs change when a material is reprocessed. */
export function courseFlashcardSourceVersion(input: {
  materialUpdatedAt: string;
  extractionVersion: string;
  sourceChunkIds: string[];
}) {
  return JSON.stringify([
    input.materialUpdatedAt,
    input.extractionVersion,
    [...new Set(input.sourceChunkIds)].sort(),
  ]);
}
