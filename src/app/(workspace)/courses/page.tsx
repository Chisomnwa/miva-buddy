import Link from "next/link";
import { CreateCourseForm } from "@/components/course-forms";
import { createClient } from "@/lib/supabase/server";

export default async function CoursesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: courses, error } = user
    ? await supabase.from("courses").select("id,title,course_code,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false })
    : { data: [], error: null };
  if (error) throw new Error("course_list_lookup_failed");
  return <div className="simple-page">
    <p className="eyebrow">YOUR STUDY MATERIAL</p><h1>Courses</h1>
    <p className="intro-copy">Keep your course notes and readings together, with concepts linked back to their source.</p>
    {courses?.length ? <section className="course-list" aria-label="Your courses">
      {courses.map((course) => <Link className="course-row" href={`/courses/${course.id}`} key={course.id}>
        <span><strong>{course.title}</strong><small>{course.course_code || "Course materials"}</small></span><span aria-hidden="true">→</span>
      </Link>)}
    </section> : <p className="empty-state">Your courses will appear here once you add one.</p>}
    <section className="content-card course-create"><p className="eyebrow">GET STARTED</p><h2>Add a course</h2><CreateCourseForm /></section>
  </div>;
}
