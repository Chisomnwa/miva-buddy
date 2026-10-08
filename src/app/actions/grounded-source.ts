"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const sourceIdSchema = z.uuid();

export async function getGroundedSourceAction(sourceId: string) {
  const parsed = sourceIdSchema.safeParse(sourceId);
  if (!parsed.success) return { source: null, error: "This source isn't available." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { source: null, error: "Your session expired. Refresh to continue." };
  const { data: chunk } = await supabase.from("material_chunks")
    .select("id,content,page_start,page_end,course_id,material_id")
    .eq("id", parsed.data).eq("user_id", user.id).maybeSingle();
  if (!chunk) return { source: null, error: "This source isn't available." };
  const { data: material } = await supabase.from("course_materials")
    .select("id,title,course_id").eq("id", chunk.material_id).eq("course_id", chunk.course_id).eq("user_id", user.id).maybeSingle();
  if (!material) return { source: null, error: "This source isn't available." };
  const { data: course } = await supabase.from("courses")
    .select("title").eq("id", material.course_id).eq("user_id", user.id).maybeSingle();
  if (!course) return { source: null, error: "This source isn't available." };
  return {
    source: {
      materialTitle: material.title,
      courseTitle: course.title,
      pageLabel: chunk.page_start === chunk.page_end ? `Page ${chunk.page_start}` : `Pages ${chunk.page_start}–${chunk.page_end}`,
      content: chunk.content,
    },
    error: null,
  };
}
