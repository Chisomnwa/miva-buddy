"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function CourseProcessingRefresh({ pending }: { pending: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(() => router.refresh(), 2_000);
    return () => window.clearInterval(timer);
  }, [pending, router]);

  return pending ? <p className="sr-only" role="status">Course materials are still processing; their status will refresh automatically.</p> : null;
}
