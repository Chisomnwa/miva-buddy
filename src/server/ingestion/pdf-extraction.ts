import { getDocument, type PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import { MAX_MATERIAL_TEXT_CHARACTERS, MAX_PDF_BYTES, MAX_PDF_PAGES } from "@/contracts/course-material";
import type { PageText } from "./chunking";

export type PdfFailureCode = "file_too_large" | "too_many_pages" | "text_too_large" | "unreadable_pdf" | "no_extractable_text";

export class PdfMaterialError extends Error {
  constructor(readonly code: PdfFailureCode) {
    super("Course PDF could not be processed");
    this.name = "PdfMaterialError";
  }
}

/** Parse only the document structure so uploads over the page limit can be rejected before persistence. */
export async function validatePdfPageCount(bytes: Uint8Array): Promise<number> {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PDF_BYTES) {
    throw new PdfMaterialError("file_too_large");
  }

  const loading = getDocument({ data: bytes, useSystemFonts: true });
  try {
    const document = await loading.promise;
    if (document.numPages > MAX_PDF_PAGES) throw new PdfMaterialError("too_many_pages");
    return document.numPages;
  } catch (error) {
    if (error instanceof PdfMaterialError) throw error;
    throw new PdfMaterialError("unreadable_pdf");
  } finally {
    await loading.destroy().catch(() => {});
  }
}

export async function extractPdfPages(bytes: Uint8Array): Promise<PageText[]> {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PDF_BYTES) {
    throw new PdfMaterialError("file_too_large");
  }

  let document: PDFDocumentProxy | undefined;
  const loading = getDocument({ data: bytes, useSystemFonts: true });
  try {
    document = await loading.promise;
    if (document.numPages > MAX_PDF_PAGES) throw new PdfMaterialError("too_many_pages");

    const pages: PageText[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        const parts: string[] = [];
        for (const item of content.items) {
          if ("str" in item) parts.push(`${item.str}${item.hasEOL ? "\n" : " "}`);
        }
        pages.push({ pageNumber, content: parts.join("").replace(/[\t ]+/g, " ").trim() });
      } finally {
        page.cleanup();
      }
    }

    if (pages.reduce((sum, page) => sum + page.content.length, 0) > MAX_MATERIAL_TEXT_CHARACTERS) {
      throw new PdfMaterialError("text_too_large");
    }

    if (!pages.some((page) => page.content.replace(/\s/g, "").length >= 20)) {
      throw new PdfMaterialError("no_extractable_text");
    }
    return pages;
  } catch (error) {
    if (error instanceof PdfMaterialError) throw error;
    throw new PdfMaterialError("unreadable_pdf");
  } finally {
    await loading.destroy().catch(() => {});
  }
}
