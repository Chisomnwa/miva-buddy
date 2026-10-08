"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { courseInputSchema, materialNotesInputSchema, MAX_PDF_BYTES } from "@/contracts/course-material";
import { createClient } from "@/lib/supabase/server";
import { getDatabasePool } from "@/server/persistence/pool";
import { enqueueMaterialProcessing } from "@/server/queue/material-jobs";

export type CourseFormResult = { error: string | null };

const formString = (data: FormData, key: string) => {
  const value = data.get(key);
  return typeof value === "string" ? value : "";
};

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
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
  const materialId = randomUUID();
  const { error: materialError } = await supabase.from("course_materials").insert({
    id: materialId, user_id: user.id, course_id: parsed.data.courseId, title: parsed.data.title,
    kind: "notes", status: "queued", storage_path: null,
  });
  if (materialError) return { error: "We couldn't save these notes. Check the course and try again." };
  const { error: pageError } = await supabase.from("material_pages").insert({
    user_id: user.id, course_id: parsed.data.courseId, material_id: materialId,
    page_number: 1, section_label: "Pasted notes", content: parsed.data.content,
  });
  if (pageError) {
    const { error: rollbackError } = await supabase.from("course_materials").delete()
      .eq("id", materialId).eq("user_id", user.id).eq("course_id", parsed.data.courseId);
    if (rollbackError) {
      await getDatabasePool().query(
        "update public.course_materials set status = 'failed', failure_code = 'notes_save_failed' where id = $1 and user_id = $2 and course_id = $3",
        [materialId, user.id, parsed.data.courseId],
      );
    }
    return { error: "We couldn't save these notes. Please try again." };
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
  if (!/^[0-9a-f-]{36}$/i.test(courseId) || title.length < 1 || title.length > 180
    || !(file instanceof File) || file.size < 8 || file.size > MAX_PDF_BYTES || !file.name.toLowerCase().endsWith(".pdf")) {
    return { error: "Choose a PDF up to 10 MB and enter a title." };
  }
  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (new TextDecoder().decode(header) !== "%PDF-") return { error: "This file doesn't appear to be a valid PDF." };
  const { supabase, user } = await currentUser();
  if (!user) return { error: "Your session expired. Refresh the page and try again." };
  const materialId = randomUUID();
  const safeName = `${materialId}.pdf`;
  const storagePath = `${user.id}/${courseId}/${materialId}/${safeName}`;
  const { error: uploadError } = await supabase.storage.from("course-materials").upload(storagePath, file, {
    contentType: "application/pdf", upsert: false,
  });
  if (uploadError) return { error: "We couldn't upload this PDF. Please try again." };
  const { error: materialError } = await supabase.from("course_materials").insert({
    id: materialId, user_id: user.id, course_id: courseId, title,
    kind: "pdf", status: "queued", storage_path: storagePath,
  });
  if (materialError) {
    await supabase.storage.from("course-materials").remove([storagePath]);
    return { error: "We couldn't add this PDF to the course. Please try again." };
  }
  const { data: signed, error: signedError } = await supabase.storage.from("course-materials").createSignedUrl(storagePath, 21_600);
  if (signedError || !signed?.signedUrl) {
    await getDatabasePool().query(
      "update public.course_materials set status = 'failed', failure_code = 'storage_access_failed' where id = $1 and user_id = $2 and course_id = $3",
      [materialId, user.id, courseId],
    );
    revalidatePath(`/courses/${courseId}`);
    redirect(`/courses/${courseId}`);
  }
  try {
    await enqueueMaterialProcessing({ kind: "pdf", userId: user.id, courseId, materialId, signedUrl: signed.signedUrl });
  } catch {
    await getDatabasePool().query(
      "update public.course_materials set status = 'failed', failure_code = 'queue_unavailable' where id = $1 and user_id = $2 and course_id = $3",
      [materialId, user.id, courseId],
    );
  }
  revalidatePath(`/courses/${courseId}`);
  redirect(`/courses/${courseId}`);
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
    .select("id,kind,storage_path,status").eq("id", materialId).eq("course_id", courseId).eq("user_id", user.id).maybeSingle();
  if (!material || material.status !== "failed") return { error: "This material is no longer available to retry." };

  let signedUrl: string | undefined;
  if (material.kind === "pdf") {
    if (!material.storage_path) return { error: "The original PDF is unavailable. Upload it again or paste the text." };
    const { data: signed, error } = await supabase.storage.from("course-materials").createSignedUrl(material.storage_path, 21_600);
    if (error || !signed?.signedUrl) return { error: "The original PDF is unavailable. Upload it again or paste the text." };
    signedUrl = signed.signedUrl;
  }
  const pool = getDatabasePool();
  const update = await pool.query(
    `update public.course_materials set status = 'queued', failure_code = null, updated_at = now()
     where id = $1 and course_id = $2 and user_id = $3 and status = 'failed'`,
    [materialId, courseId, user.id],
  );
  if (update.rowCount !== 1) return { error: "This material could not be retried. Refresh and try again." };
  try {
    await enqueueMaterialProcessing(material.kind === "notes"
      ? { kind: "notes", userId: user.id, courseId, materialId }
      : { kind: "pdf", userId: user.id, courseId, materialId, signedUrl: signedUrl! });
  } catch {
    await pool.query(
      `update public.course_materials set status = 'failed', failure_code = 'queue_unavailable', updated_at = now()
       where id = $1 and course_id = $2 and user_id = $3 and status = 'queued'`,
      [materialId, courseId, user.id],
    );
    return { error: "Processing could not be queued. Please try again shortly." };
  }
  revalidatePath(`/courses/${courseId}`);
  redirect(`/courses/${courseId}`);
}
