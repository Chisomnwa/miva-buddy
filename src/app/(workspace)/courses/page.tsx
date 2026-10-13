import Link from "next/link";
import { CreateCourseForm } from "@/components/course-forms";
import { displayCourseTitle } from "@/lib/course-title-display";
import { getPermanentUser } from "@/lib/auth/permanent-user";

export default async function CoursesPage() {
  const { supabase, user } = await getPermanentUser();
  const { data: courses, error } = user
    ? await supabase.from("courses").select("id,title,course_code,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false })
    : { data: [], error: null };
  if (error) throw new Error("course_list_lookup_failed");
  return <div className="simple-page">
    <p className="eyebrow">YOUR STUDY MATERIAL</p><h1>Courses</h1>
    <p className="intro-copy">Create a course space for each class, then add notes or PDFs to discover concepts with source references.</p>
    {courses?.length ? <section className="course-list" aria-label="Your courses">
      {courses.map((course) => <Link className="course-row" href={`/courses/${course.id}`} key={course.id}>
        <span><strong>{displayCourseTitle(course.title)}</strong><small>{course.course_code || "Course materials"}</small></span><span aria-hidden="true">→</span>
      </Link>)}
    </section> : <p className="empty-state">Your courses will appear here once you add one.</p>}
    <section className="content-card course-create"><p className="eyebrow">ADD A COURSE</p><h2>Create a course space</h2><p className="course-form-intro">Use the full title you recognize from your timetable. A course code is optional.</p><CreateCourseForm /></section>
  </div>;
}
