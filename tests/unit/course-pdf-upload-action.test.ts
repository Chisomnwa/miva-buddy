import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getDatabasePool: vi.fn(),
  enqueueMaterialProcessing: vi.fn(),
  upload: vi.fn(),
  storageRemove: vi.fn(),
  table: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/server/persistence/pool", () => ({ getDatabasePool: mocks.getDatabasePool }));
vi.mock("@/server/queue/material-jobs", () => ({ enqueueMaterialProcessing: mocks.enqueueMaterialProcessing }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("server-only", () => ({}));

import { uploadPdfAction } from "@/app/actions/courses";
import { validatePdfPageCount } from "@/server/ingestion/pdf-extraction";
import nextConfig from "../../next.config";

function syntheticPdf(pageCount: number): Uint8Array {
  const stream = "BT /F1 12 Tf 40 100 Td (Page text for preflight.) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${Array.from({ length: pageCount }, (_, index) => `${3 + index * 2} 0 R`).join(" ")}] /Count ${pageCount} >>`,
    ...Array.from({ length: pageCount }, (_, index) => [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 800 144] /Resources << /Font << /F1 ${3 + pageCount * 2} 0 R >> >> /Contents ${4 + index * 2} 0 R >>`,
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    ]).flat(),
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

function syntheticPdfFile(name: string): File {
  const bytes = syntheticPdf(1);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new File([buffer], name, { type: "application/pdf" });
}

describe("PDF upload server-side preflight", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.upload.mockResolvedValue({ error: null });
    mocks.storageRemove.mockResolvedValue({ error: null });
    mocks.table.mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: null }) });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner-id" } } }) },
      storage: { from: vi.fn(() => ({
        upload: mocks.upload,
        remove: mocks.storageRemove,
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://example.invalid/signed" }, error: null }),
      })) },
      from: mocks.table,
    });
  });

  it("keeps PDF.js external so Next.js can resolve its package-relative Node worker", () => {
    expect(nextConfig.serverExternalPackages).toContain("pdfjs-dist");
  });

  it("accepts the repository's synthetic one-page upload fixture", async () => {
    expect(await validatePdfPageCount(syntheticPdf(1))).toBe(1);
  });

  it("runs a valid synthetic PDF through the upload action's exact preflight path", async () => {
    const data = new FormData();
    data.set("courseId", "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
    data.set("title", "Synthetic one-page PDF");
    const pdfBytes = syntheticPdf(1);
    const pdfBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;
    data.set("file", new File([pdfBuffer], "synthetic.pdf", { type: "application/pdf" }));

    await uploadPdfAction({ error: null }, data);

    expect(mocks.upload).toHaveBeenCalledOnce();
    expect(mocks.table).toHaveBeenCalledWith("course_materials");
    expect(mocks.enqueueMaterialProcessing).toHaveBeenCalledOnce();
  });

  it("reports a fixed Storage failure category without logging the provider error", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const providerError = { message: "sensitive storage detail" };
    mocks.upload.mockResolvedValueOnce({ error: providerError });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const data = new FormData();
    data.set("courseId", "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
    data.set("title", "Synthetic PDF");
    data.set("file", syntheticPdfFile("synthetic.pdf"));

    await expect(uploadPdfAction({ error: null }, data)).resolves.toEqual({
      error: "We couldn't upload this PDF. Please try again.",
    });
    expect(warning).toHaveBeenCalledWith("pdf_upload_diagnostic", {
      stage: "storage_upload",
      category: "operation_rejected",
    });
    expect(warning.mock.calls.flat().join(" ")).not.toContain("sensitive storage detail");
    expect(mocks.table).not.toHaveBeenCalled();
  });

  it("reports material insertion and cleanup failures using fixed categories", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mocks.table.mockReturnValueOnce({ insert: vi.fn().mockResolvedValue({ error: { message: "private database detail" } }) });
    mocks.storageRemove.mockResolvedValueOnce({ error: { message: "private cleanup detail" } });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const data = new FormData();
    data.set("courseId", "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
    data.set("title", "Synthetic PDF");
    data.set("file", syntheticPdfFile("synthetic.pdf"));

    await expect(uploadPdfAction({ error: null }, data)).resolves.toEqual({
      error: "We couldn't add this PDF to the course. Please try again.",
    });
    expect(warning.mock.calls).toEqual([
      ["pdf_upload_diagnostic", { stage: "material_insert", category: "operation_rejected" }],
      ["pdf_upload_diagnostic", { stage: "storage_cleanup", category: "cleanup_rejected" }],
    ]);
    expect(warning.mock.calls.flat().join(" ")).not.toMatch(/private database detail|private cleanup detail/);
  });

  it("reports a queue failure while retaining the existing failed-material behavior", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mocks.enqueueMaterialProcessing.mockRejectedValueOnce(new Error("private queue detail"));
    const statusUpdate = vi.fn().mockResolvedValue({});
    mocks.getDatabasePool.mockReturnValue({ query: statusUpdate });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const data = new FormData();
    data.set("courseId", "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
    data.set("title", "Synthetic PDF");
    data.set("file", syntheticPdfFile("synthetic.pdf"));

    await uploadPdfAction({ error: null }, data);

    expect(warning).toHaveBeenCalledWith("pdf_upload_diagnostic", {
      stage: "queue_create",
      category: "operation_threw",
    });
    expect(statusUpdate).toHaveBeenCalledOnce();
    expect(warning.mock.calls.flat().join(" ")).not.toContain("private queue detail");
  });

  it("rejects an over-limit PDF before Storage upload or material-row creation", async () => {
    const data = new FormData();
    data.set("courseId", "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
    data.set("title", "Too many pages");
    const pdfBytes = syntheticPdf(121);
    const pdfBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;
    data.set("file", new File([pdfBuffer], "lecture.pdf", { type: "application/pdf" }));

    await expect(uploadPdfAction({ error: null }, data)).resolves.toEqual({
      error: "This PDF has more than the supported 120 pages. Choose a shorter PDF.",
    });
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.table).not.toHaveBeenCalled();
    expect(mocks.enqueueMaterialProcessing).not.toHaveBeenCalled();
  });

  it("rejects unsupported file extensions before authentication or persistence", async () => {
    const data = new FormData();
    data.set("courseId", "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
    data.set("title", "Not a PDF");
    data.set("file", new File(["not a PDF"], "notes.txt", { type: "text/plain" }));

    const result = await uploadPdfAction({ error: null }, data);
    expect(result.error).toContain("PDF file");
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.table).not.toHaveBeenCalled();
  });

  it("reports malformed PDF structure separately and never uploads it", async () => {
    const data = new FormData();
    data.set("courseId", "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
    data.set("title", "Malformed PDF");
    data.set("file", new File(["%PDF-1.4\nnot a valid PDF structure"], "broken.pdf", { type: "application/pdf" }));

    await expect(uploadPdfAction({ error: null }, data)).resolves.toEqual({
      error: "This PDF has an invalid file structure. Choose another PDF or paste your notes instead.",
    });
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.table).not.toHaveBeenCalled();
    expect(mocks.enqueueMaterialProcessing).not.toHaveBeenCalled();
  });

  it("distinguishes a selected-file read failure without exposing the raw error", async () => {
    const data = new FormData();
    data.set("courseId", "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
    data.set("title", "Unreadable selection");
    const file = new File(["%PDF-1.4\nvalid header"], "lecture.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "arrayBuffer", {
      value: vi.fn().mockRejectedValue(new Error("private filesystem detail")),
    });
    data.set("file", file);

    await expect(uploadPdfAction({ error: null }, data)).resolves.toEqual({
      error: "We couldn't read the selected PDF file. Please choose it again or try another PDF.",
    });
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.table).not.toHaveBeenCalled();
  });
});
