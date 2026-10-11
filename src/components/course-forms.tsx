"use client";

import { useActionState, useState, type FormEvent } from "react";
import { addNotesAction, createCourseAction, removeFailedMaterialAction, retryMaterialAction, uploadPdfAction, type CourseFormResult } from "@/app/actions/courses";
import { pdfFileMetadataError } from "@/contracts/course-material";

const initial: CourseFormResult = { error: null };

export function CreateCourseForm() {
  const [state, action, pending] = useActionState(createCourseAction, initial);
  return <form action={action} className="form-stack course-form">
    <label className="field">Course name<input name="title" required minLength={2} maxLength={120} autoComplete="off" /></label>
    <label className="field">Course code <span className="optional-label">Optional</span><input name="courseCode" maxLength={40} autoComplete="off" /></label>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    <button className="button button-primary" disabled={pending}>{pending ? "Creating…" : "Create course"}</button>
  </form>;
}

export function MaterialForms({ courseId }: { courseId: string }) {
  const [notesState, notesAction, notesPending] = useActionState(addNotesAction, initial);
  const [pdfState, pdfAction, pdfPending] = useActionState(uploadPdfAction, initial);
  const [pdfClientError, setPdfClientError] = useState<string | null>(null);

  function validatePdfBeforeSubmit(event: FormEvent<HTMLFormElement>) {
    const fileInput = event.currentTarget.elements.namedItem("file");
    const file = fileInput instanceof HTMLInputElement ? fileInput.files?.[0] ?? null : null;
    const validationError = pdfFileMetadataError(file);
    if (validationError) {
      event.preventDefault();
      setPdfClientError(validationError);
    }
  }

  return <section className="material-forms" aria-label="Add course material">
    <div className="content-card">
      <p className="eyebrow">PASTE NOTES</p><h2>Add notes</h2>
      <form action={notesAction} className="form-stack">
        <input type="hidden" name="courseId" value={courseId} />
        <label className="field">Material title<input name="title" required maxLength={180} /></label>
        <label className="field">Notes<textarea name="content" required maxLength={100000} rows={8} aria-describedby="notes-limit" /></label>
        <small id="notes-limit" className="field-hint">Up to 100,000 characters.</small>
        {notesState.error && <p className="form-error" role="alert">{notesState.error}</p>}
        <button className="button button-primary" disabled={notesPending}>{notesPending ? "Saving…" : "Save notes"}</button>
      </form>
    </div>
    <div className="content-card">
      <p className="eyebrow">PDF DOCUMENT</p><h2>Upload a PDF</h2>
      <form action={pdfAction} className="form-stack" onSubmit={validatePdfBeforeSubmit}>
        <input type="hidden" name="courseId" value={courseId} />
        <label className="field">Material title<input name="title" required maxLength={180} /></label>
        <label className="field">Choose PDF<input name="file" type="file" accept="application/pdf,.pdf" required aria-describedby="pdf-limit" onChange={(event) => {
          const file = event.currentTarget.files?.[0] ?? null;
          setPdfClientError(file ? pdfFileMetadataError(file) : null);
        }} /></label>
        <small id="pdf-limit" className="field-hint">PDF only · maximum 10 MiB and 120 pages. Files over either limit are rejected before they are saved to this course.</small>
        {pdfClientError && <p className="form-error" role="alert">{pdfClientError}</p>}
        {pdfState.error && <p className="form-error" role="alert">{pdfState.error}</p>}
        <button className="button button-primary" disabled={pdfPending}>{pdfPending ? "Uploading…" : "Upload PDF"}</button>
      </form>
    </div>
  </section>;
}

export function RetryMaterialForm({ courseId, materialId }: { courseId: string; materialId: string }) {
  const [state, action, pending] = useActionState(retryMaterialAction, initial);
  return <form action={action} className="retry-form">
    <input type="hidden" name="courseId" value={courseId} />
    <input type="hidden" name="materialId" value={materialId} />
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    <button className="button button-secondary" disabled={pending}>{pending ? "Retrying…" : "Retry processing"}</button>
  </form>;
}

export function RemoveFailedMaterialForm({ courseId, materialId }: { courseId: string; materialId: string }) {
  const [state, action, pending] = useActionState(removeFailedMaterialAction, initial);
  return <form action={action} className="retry-form">
    <input type="hidden" name="courseId" value={courseId} />
    <input type="hidden" name="materialId" value={materialId} />
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    <button className="button button-secondary" disabled={pending}>{pending ? "Removing…" : "Remove failed material"}</button>
  </form>;
}
