import { describe, expect, it } from "vitest";
import { chunkMaterialPages } from "@/server/ingestion/chunking";
import { extractPdfPages, PdfMaterialError } from "@/server/ingestion/pdf-extraction";
import { MAX_PDF_BYTES, courseInputSchema, materialNotesInputSchema } from "@/contracts/course-material";

function makeTextPdf(text: string) {
  return makePdfPages([text]);
}

function makePdfPages(texts: Array<string | string[]>) {
  const pageReferences = texts.map((_, index) => `${3 + index * 2} 0 R`).join(" ");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageReferences}] /Count ${texts.length} >>`,
    ...texts.flatMap((text, index) => {
      const pageNumber = 3 + index * 2;
      const contentNumber = pageNumber + 1;
      const fragments = (Array.isArray(text) ? text : [text]).map((part) => part.replace(/[()\\]/g, "\\$&"));
      const stream = `BT /F1 12 Tf 40 80 Td (${fragments[0]}) Tj ${fragments.slice(1).map((fragment, partIndex) => `${partIndex === 0 ? "260 0 Td" : "0 -20 Td"} (${fragment}) Tj`).join(" ")} ET`;
      return [
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 800 144] /Resources << /Font << /F1 ${3 + texts.length * 2} 0 R >> >> /Contents ${contentNumber} 0 R >>`,
        `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
      ];
    }),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Uint8Array(Buffer.from(pdf));
}

function makeImageOnlyPdf() {
  const stream = `q 200 0 0 100 40 20 cm BI /W 1 /H 1 /CS /RGB /BPC 8 ID ${String.fromCharCode(255, 255, 255)} EI Q`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 800 144] /Resources << >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Uint8Array(Buffer.from(pdf, "latin1"));
}

describe("course material contracts and source-preserving preparation", () => {
  it("normalizes and validates course fields", () => {
    expect(courseInputSchema.parse({ title: "  Data Structures  ", courseCode: " CSC 201 " }))
      .toEqual({ title: "Data Structures", courseCode: "CSC 201" });
    expect(courseInputSchema.safeParse({ title: "x" }).success).toBe(false);
  });

  it("bounds pasted notes and associates them with a valid course", () => {
    const parsed = materialNotesInputSchema.safeParse({
      courseId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      title: "Lecture notes",
      content: "A useful note.",
    });
    expect(parsed.success).toBe(true);
    expect(materialNotesInputSchema.safeParse({
      courseId: "not-a-uuid", title: "Notes", content: "Text",
    }).success).toBe(false);
  });

  it("extracts text page-by-page from a small synthetic PDF", async () => {
    const pages = await extractPdfPages(makeTextPdf("Recursion repeats a process until it reaches a base case."));
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({ pageNumber: 1 });
    expect(pages[0].content).toContain("base case");
  });

  it("preserves two-page provenance and extracts text drawn in separate columns", async () => {
    const pages = await extractPdfPages(makePdfPages([
      "First page discusses tree nodes and roots.",
      "Second page discusses leaves and traversal.",
    ]));
    expect(pages.map((page) => page.pageNumber)).toEqual([1, 2]);
    expect(pages[0].content).toContain("tree nodes");
    expect(pages[1].content).toContain("traversal");

    const columns = await extractPdfPages(makePdfPages([[
      "Left column defines a tree.", "Right column gives an example.",
    ]]));
    expect(columns[0].content).toContain("Left column");
    expect(columns[0].content).toContain("Right column");
  });

  it("rejects corrupt and image-only or text-empty PDFs with safe failure codes", async () => {
    await expect(extractPdfPages(new Uint8Array([1, 2, 3])))
      .rejects.toMatchObject({ code: "unreadable_pdf" });
    await expect(extractPdfPages(makeTextPdf("")))
      .rejects.toMatchObject({ code: "no_extractable_text" });
    await expect(extractPdfPages(makeImageOnlyPdf()))
      .rejects.toMatchObject({ code: "no_extractable_text" });
    await expect(extractPdfPages(new Uint8Array(MAX_PDF_BYTES + 1)))
      .rejects.toBeInstanceOf(PdfMaterialError);
  });

  it("chunks long pages deterministically while preserving page provenance", () => {
    const pages = [
      { pageNumber: 2, content: "Second page concept. ".repeat(40) },
      { pageNumber: 1, content: "First page concept. ".repeat(40) },
    ];
    const chunks = chunkMaterialPages(pages, { maxCharacters: 200, overlapCharacters: 20 });
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.map((chunk) => chunk.ordinal)).toEqual(chunks.map((_, index) => index));
    expect(chunks.every((chunk) => chunk.content.length <= 200)).toBe(true);
    expect(chunks.filter((chunk) => chunk.pageStart === 1).length).toBeGreaterThan(1);
    expect(chunks.filter((chunk) => chunk.pageStart === 2).length).toBeGreaterThan(1);
  });
});
