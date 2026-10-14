"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { courseInputSchema, materialNotesInputSchema, pdfFileMetadataError } from "@/contracts/course-material";
import { getPermanentUser } from "@/lib/auth/permanent-user";
import { getDatabasePool } from "@/server/persistence/pool";
import { enqueueMaterialProcessing } from "@/server/queue/material-jobs";
import { PdfMaterialError, validatePdfPageCount } from "@/server/ingestion/pdf-extraction";
import { removeFailedMaterial } from "@/server/courses/remove-failed-material";
import {
  finalizeCourseMaterialAdmission,
  materialAdmissionMessage,
  queueManualMaterialRetry,
  releaseCourseMaterialAdmission,
  reserveCourseMaterialAdmission,
  undoUnqueuedManualRetry,
} from "@/server/courses/material-admission";
import { getServerConfig } from "@/lib/config";

export type CourseFormResult = { error: string | null };

type PdfUploadDiagnosticStage = "storage_upload" | "material_insert" | "storage_cleanup" | "signed_url" | "queue_create" | "queue_status_update";
type PdfUploadDiagnosticCategory =
  | "operation_rejected"
  | "operation_threw"
  | "cleanup_rejected"
  | "cleanup_threw";

function logPdfUploadDiagnostic(stage: PdfUploadDiagnosticStage, category: PdfUploadDiagnosticCategory) {
  if (process.env.NODE_ENV === "development") {
    console.warn("pdf_upload_diagnostic", { stage, category });
  }
}

const formString = (data: FormData, key: string) => {
  const value = data.get(key);
  return typeof value === "string" ? value : "";
};

async function currentUser() {
  return getPermanentUser();
}

export async function createCourseAction(_previous: CourseFormResult, data: FormData): Promise<CourseFormResult> {
  const parsed = courseInputSchema.safeParse({ title: formString(data, "title"), courseCode: formString(data, "courseCode") });
  if (!parsed.success) return { error: "Enter a course name between 2 and 120 characters." };
  const { supabase, user } = await currentUser();
  if (!user) return { error: "Your session expired. Refresh the page and try again." };
  const { data: course, error } = await supabase.from("courses").insert({
    user_id: user.id, title: parsed.data.title, course_code: parsed.data.courseCode,
  }).select("id").single();
  if (error || !course) return { error: "We couldn't save this course. Please try again." };
  revalidatePath("/courses");
  redirect(`/courses/${course.id}`);
}

export async function addNotesAction(_previous: CourseFormResult, data: FormData): Promise<CourseFormResult> {
  const parsed = materialNotesInputSchema.safeParse({
    courseId: formString(data, "courseId"), title: formString(data, "title"), content: formString(data, "content"),
  });
  if (!parsed.success) return { error: "Add a title and notes (up to 100,000 characters)." };
  const { supabase, user } = await currentUser();
  if (!user) return { error: "Your session expired. Refresh the page and try again." };
  const { data: course } = await supabase.from("courses").select("id")
    .eq("id", parsed.data.courseId).eq("user_id", user.id).maybeSingle();
  if (!course) return { error: "We couldn't find this course. Refresh and try again." };
  const pool = getDatabasePool();
  const admission = await reserveCourseMaterialAdmission({
    userId: user.id,
    uploadBytes: Buffer.byteLength(parsed.data.content, "utf8"),
    pool,
  });
  if (admission.status !== "reserved") return { error: materialAdmissionMessage(admission.status) };
  if (!admission.reservationId) return { error: materialAdmissionMessage("unavailable") };
  const materialId = randomUUID();
  const { error: materialError } = await supabase.from("course_materials").insert({
    id: materialId, user_id: user.id, course_id: parsed.data.courseId, title: parsed.data.title,
    kind: "notes", status: "queued", storage_path: null,
  });
  if (materialError) {
    await releaseCourseMaterialAdmission({ reservationId: admission.reservationId, userId: user.id, pool });
    return { error: "We couldn't save these notes. Check the course and try again." };
  }
  const { error: pageError } = await supabase.from("material_pages").insert({
    user_id: user.id, course_id: parsed.data.courseId, material_id: materialId,
    page_number: 1, section_label: "Pasted notes", content: parsed.data.content,
  });
  if (pageError) {
    const { error: rollbackError } = await supabase.from("course_materials").delete()
      .eq("id", materialId).eq("user_id", user.id).eq("course_id", parsed.data.courseId);
    if (rollbackError) {
      await pool.query(
        "update public.course_materials set status = 'failed', failure_code = 'notes_save_failed' where id = $1 and user_id = $2 and course_id = $3",
        [materialId, user.id, parsed.data.courseId],
      );
    } else {
      await releaseCourseMaterialAdmission({ reservationId: admission.reservationId, userId: user.id, pool });
    }
    return { error: "We couldn't save these notes. Please try again." };
  }
  if (!await finalizeCourseMaterialAdmission({ reservationId: admission.reservationId, userId: user.id, pool })) {
    const { error: rollbackError } = await supabase.from("course_materials").delete()
      .eq("id", materialId).eq("user_id", user.id).eq("course_id", parsed.data.courseId);
    if (!rollbackError) await releaseCourseMaterialAdmission({ reservationId: admission.reservationId, userId: user.id, pool });
    return { error: "Course materials are temporarily unavailable. Please try again." };
  }
  try {
    await enqueueMaterialProcessing({ kind: "notes", userId: user.id, courseId: parsed.data.courseId, materialId });
  } catch {
    await getDatabasePool().query(
      "update public.course_materials set status = 'failed', failure_code = 'queue_unavailable' where id = $1 and user_id = $2 and course_id = $3",
      [materialId, user.id, parsed.data.courseId],
    );
  }
  revalidatePath(`/courses/${parsed.data.courseId}`);
  redirect(`/courses/${parsed.data.courseId}`);
}

export async function uploadPdfAction(_previous: CourseFormResult, data: FormData): Promise<CourseFormResult> {
  const courseId = formString(data, "courseId");
  const title = formString(data, "title").trim();
  const file = data.get("file");
  if (!/^[0-9a-f-]{36}$/i.test(courseId) || title.length < 1 || title.length > 180 || !(file instanceof File)) {
    return { error: "Choose a PDF up to 10 MiB, within the 120-page limit, and enter a title." };
  }
  const metadataError = pdfFileMetadataError(file);
  if (metadataError) return { error: metadataError };
  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (new TextDecoder().decode(header) !== "%PDF-") return { error: "This file doesn't appear to be a valid PDF." };
  const { supabase, user } = await currentUser();
  if (!user) return { error: "Your session expired. Refresh the page and try again." };
  let pdfBytes: Uint8Array;
  try {
    pdfBytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    if (process.env.NODE_ENV === "development") {
      console.warn("pdf_upload_validation_diagnostic", {
        stage: "file_read",
        category: "file_read_failure",
        cause: "array_buffer_rejected",
      });
    }
    return { error: "We couldn't read the selected PDF file. Please choose it again or try another PDF." };
  }
  try {
    await validatePdfPageCount(pdfBytes);
  } catch (error) {
    if (error instanceof PdfMaterialError && process.env.NODE_ENV === "development") {
      console.warn("pdf_upload_validation_diagnostic", {
        stage: "page_count",
        category: error.code,
        cause: error.diagnosticCause ?? "validation_rejected",
      });
    }
    if (error instanceof PdfMaterialError && error.code === "too_many_pages") {
      return { error: "This PDF has more than the supported 120 pages. Choose a shorter PDF." };
    }
    if (error instanceof PdfMaterialError && error.code === "file_too_large") {
      return { error: "This PDF is larger than the 10 MiB limit." };
    }
    if (error instanceof PdfMaterialError && error.code === "invalid_pdf") {
      return { error: "This PDF has an invalid file structure. Choose another PDF or paste your notes instead." };
    }
    if (error instanceof PdfMaterialError && error.code === "password_protected_pdf") {
      return { error: "This PDF is password-protected. Remove its password or paste your notes instead." };
    }
    return { error: "Our PDF reader could not validate this file. Try another PDF or paste your notes instead." };
  }
  const { data: course } = await supabase.from("courses").select("id")
    .eq("id", courseId).eq("user_id", user.id).maybeSingle();
  if (!course) return { error: "We couldn't find this course. Refresh and try again." };
  const pool = getDatabasePool();
  const admission = await reserveCourseMaterialAdmission({ userId: user.id, uploadBytes: file.size, pool });
  if (admission.status !== "reserved") return { error: materialAdmissionMessage(admission.status) };
  if (!admission.reservationId) return { error: materialAdmissionMessage("unavailable") };
  const materialId = randomUUID();
  const safeName = `${materialId}.pdf`;
  const storagePath = `${user.id}/${courseId}/${materialId}/${safeName}`;
  let uploadError: unknown;
  try {
    ({ error: uploadError } = await supabase.storage.from("course-materials").upload(storagePath, file, {
      contentType: "application/pdf", upsert: false,
    }));
  } catch {
    logPdfUploadDiagnostic("storage_upload", "operation_threw");
    await releaseCourseMaterialAdmission({ reservationId: admission.reservationId, userId: user.id, pool });
    return { error: "We couldn't upload this PDF. Please try again." };
  }
  if (uploadError) {
    logPdfUploadDiagnostic("storage_upload", "operation_rejected");
    await releaseCourseMaterialAdmission({ reservationId: admission.reservationId, userId: user.id, pool });
    return { error: "We couldn't upload this PDF. Please try again." };
  }
  let materialError: unknown;
  try {
    ({ error: materialError } = await supabase.from("course_materials").insert({
      id: materialId, user_id: user.id, course_id: courseId, title,
      kind: "pdf", status: "queued", storage_path: storagePath,
    }));
  } catch {
    materialError = true;
  }
  if (materialError) {
    logPdfUploadDiagnostic("material_insert", materialError === true ? "operation_threw" : "operation_rejected");
    let storageRemoved = false;
    try {
      const { error: cleanupError } = await supabase.storage.from("course-materials").remove([storagePath]);
      if (cleanupError) logPdfUploadDiagnostic("storage_cleanup", "cleanup_rejected");
      else storageRemoved = true;
    } catch {
      logPdfUploadDiagnostic("storage_cleanup", "cleanup_threw");
    }
    if (storageRemoved) await releaseCourseMaterialAdmission({ reservationId: admission.reservationId, userId: user.id, pool });
    return { error: "We couldn't add this PDF to the course. Please try again." };
  }
  if (!await finalizeCourseMaterialAdmission({ reservationId: admission.reservationId, userId: user.id, pool })) {
    const { error: rollbackError } = await supabase.from("course_materials").delete()
      .eq("id", materialId).eq("user_id", user.id).eq("course_id", courseId);
    let storageRemoved = false;
    try {
      const { error: cleanupError } = await supabase.storage.from("course-materials").remove([storagePath]);
      if (cleanupError) logPdfUploadDiagnostic("storage_cleanup", "cleanup_rejected");
      else storageRemoved = true;
    } catch {
      logPdfUploadDiagnostic("storage_cleanup", "cleanup_threw");
    }
    if (!rollbackError && storageRemoved) {
      await releaseCourseMaterialAdmission({ reservationId: admission.reservationId, userId: user.id, pool });
    }
    return { error: "Course materials are temporarily unavailable. Please try again." };
  }
  let signed: { signedUrl?: string } | null | undefined;
  let signedError: unknown;
  try {
    ({ data: signed, error: signedError } = await supabase.storage.from("course-materials").createSignedUrl(storagePath, 21_600));
  } catch {
    signedError = true;
  }
  if (signedError || !signed?.signedUrl) {
    logPdfUploadDiagnostic("signed_url", signedError === true ? "operation_threw" : "operation_rejected");
    try {
      await getDatabasePool().query(
        "update public.course_materials set status = 'failed', failure_code = 'storage_access_failed' where id = $1 and user_id = $2 and course_id = $3",
        [materialId, user.id, courseId],
      );
    } catch {
      logPdfUploadDiagnostic("signed_url", "operation_threw");
    }
    revalidatePath(`/courses/${courseId}`);
    redirect(`/courses/${courseId}`);
  }
  try {
    await enqueueMaterialProcessing({ kind: "pdf", userId: user.id, courseId, materialId, signedUrl: signed.signedUrl });
  } catch {
    logPdfUploadDiagnostic("queue_create", "operation_threw");
    try {
      await getDatabasePool().query(
        "update public.course_materials set status = 'failed', failure_code = 'queue_unavailable' where id = $1 and user_id = $2 and course_id = $3",
        [materialId, user.id, courseId],
      );
    } catch {
      logPdfUploadDiagnostic("queue_status_update", "operation_threw");
    }
  }
  revalidatePath(`/courses/${courseId}`);
  redirect(`/courses/${courseId}`);
}

export async function removeFailedMaterialAction(_previous: CourseFormResult, data: FormData): Promise<CourseFormResult> {
  const courseId = formString(data, "courseId");
  const materialId = formString(data, "materialId");
  if (!/^[0-9a-f-]{36}$/i.test(courseId) || !/^[0-9a-f-]{36}$/i.test(materialId)) {
    return { error: "This failed material could not be removed. Refresh and try again." };
  }
  const { supabase, user } = await currentUser();
  if (!user) return { error: "Your session expired. Refresh and try again." };

  const result = await removeFailedMaterial(getDatabasePool(), { courseId, materialId, userId: user.id }, async (path) => {
    const { error } = await supabase.storage.from("course-materials").remove([path]);
    return !error;
  });
  if (result === "removed") {
    revalidatePath(`/courses/${courseId}`);
    redirect(`/courses/${courseId}`);
  }
  if (result === "not_found") return { error: "This material is no longer failed and cannot be removed." };
  if (result === "storage_failed") return { error: "We couldn't remove the private PDF, so its material card was kept. Please try again." };
  if (result === "partial_failure") {
    revalidatePath(`/courses/${courseId}`);
    return { error: "The PDF may have been removed, but its material card could not be cleared. Please retry removal." };
  }
  return { error: "We couldn't remove this failed material. No other course materials were changed." };
}

export async function retryMaterialAction(_previous: CourseFormResult, data: FormData): Promise<CourseFormResult> {
  const courseId = formString(data, "courseId");
  const materialId = formString(data, "materialId");
  if (!/^[0-9a-f-]{36}$/i.test(courseId) || !/^[0-9a-f-]{36}$/i.test(materialId)) {
    return { error: "This material could not be retried. Refresh and try again." };
  }
  const { supabase, user } = await currentUser();
  if (!user) return { error: "Your session expired. Refresh the page and try again." };
  const { data: material } = await supabase.from("course_materials")
    .select("id,kind,storage_path,status,manual_retry_count").eq("id", materialId).eq("course_id", courseId).eq("user_id", user.id).maybeSingle();
  if (!material || material.status !== "failed") return { error: "This material is no longer available to retry." };
  const retryLimit = getServerConfig().COURSE_MATERIAL_MANUAL_RETRY_LIMIT;
  if (material.manual_retry_count >= retryLimit) return { error: "This material has reached its processing retry limit. Add it again if you still need it." };

  let signedUrl: string | undefined;
  if (material.kind === "pdf") {
    if (!material.storage_path) return { error: "The original PDF is unavailable. Upload it again or paste the text." };
    const { data: signed, error } = await supabase.storage.from("course-materials").createSignedUrl(material.storage_path, 21_600);
    if (error || !signed?.signedUrl) return { error: "The original PDF is unavailable. Upload it again or paste the text." };
    signedUrl = signed.signedUrl;
  }
  const pool = getDatabasePool();
  const retryQueued = await queueManualMaterialRetry({ materialId, courseId, userId: user.id, retryLimit, pool });
  if (!retryQueued) return { error: "This material could not be retried. Refresh and try again." };
  try {
    await enqueueMaterialProcessing(material.kind === "notes"
      ? { kind: "notes", userId: user.id, courseId, materialId }
      : { kind: "pdf", userId: user.id, courseId, materialId, signedUrl: signedUrl! });
  } catch {
    await undoUnqueuedManualRetry({ materialId, courseId, userId: user.id, pool });
    return { error: "Processing could not be queued. Please try again shortly." };
  }
  revalidatePath(`/courses/${courseId}`);
  redirect(`/courses/${courseId}`);
}
