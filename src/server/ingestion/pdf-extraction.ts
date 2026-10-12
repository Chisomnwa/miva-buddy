import {
  getDocument,
  InvalidPDFException,
  PasswordException,
  type PDFDocumentProxy,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import { MAX_MATERIAL_TEXT_CHARACTERS, MAX_PDF_BYTES, MAX_PDF_PAGES } from "@/contracts/course-material";
import type { PageText } from "./chunking";

export type PdfFailureCode =
  | "file_too_large"
  | "too_many_pages"
  | "text_too_large"
  | "unreadable_pdf"
  | "invalid_pdf"
  | "password_protected_pdf"
  | "pdf_parser_failure"
  | "no_extractable_text";

export type PdfParserDiagnosticCause =
  | "invalid_pdf_exception"
  | "password_exception"
  | "pdfjs_unknown_error"
  | "pdfjs_response_error"
  | "pdfjs_format_error"
  | "pdfjs_worker_setup_failure"
  | "pdfjs_worker_source_missing"
  | "type_error"
  | "reference_error"
  | "range_error"
  | "other_error"
  | "non_error_throwable";

export class PdfMaterialError extends Error {
  constructor(readonly code: PdfFailureCode, readonly diagnosticCause?: PdfParserDiagnosticCause) {
    super("Course PDF could not be processed");
    this.name = "PdfMaterialError";
  }
}

/** Classify parser failures with fixed codes; never retain PDF.js messages or details. */
export function classifyPdfParserFailure(error: unknown): PdfMaterialError {
  if (error instanceof PdfMaterialError) return error;
  if (error instanceof InvalidPDFException) return new PdfMaterialError("invalid_pdf", "invalid_pdf_exception");
  if (error instanceof PasswordException) return new PdfMaterialError("password_protected_pdf", "password_exception");
  if (!(error instanceof Error)) return new PdfMaterialError("pdf_parser_failure", "non_error_throwable");
  if (error.message.startsWith("Setting up fake worker failed:")) {
    return new PdfMaterialError("pdf_parser_failure", "pdfjs_worker_setup_failure");
  }
  if (error.message === 'No "GlobalWorkerOptions.workerSrc" specified.') {
    return new PdfMaterialError("pdf_parser_failure", "pdfjs_worker_source_missing");
  }
  const knownCauses: Record<string, PdfParserDiagnosticCause> = {
    UnknownErrorException: "pdfjs_unknown_error",
    ResponseException: "pdfjs_response_error",
    FormatError: "pdfjs_format_error",
    TypeError: "type_error",
    ReferenceError: "reference_error",
    RangeError: "range_error",
  };
  return new PdfMaterialError("pdf_parser_failure", knownCauses[error.name] ?? "other_error");
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
    throw classifyPdfParserFailure(error);
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
    throw classifyPdfParserFailure(error);
  } finally {
    await loading.destroy().catch(() => {});
  }
}
