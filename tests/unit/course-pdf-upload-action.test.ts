import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("PDF upload server-side preflight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.upload.mockResolvedValue({ error: null });
    mocks.storageRemove.mockResolvedValue({ error: null });
    mocks.table.mockReturnValue({ insert: vi.fn() });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner-id" } } }) },
      storage: { from: vi.fn(() => ({ upload: mocks.upload, remove: mocks.storageRemove })) },
      from: mocks.table,
    });
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
});
