"use client";

import { useState } from "react";
import { industryDemoSchema, type IndustryDemo } from "@/contracts/industry-demo";
import { GroundedLearnComposer } from "@/components/grounded-learn-composer";
import { GroundedLearnConversation, type GroundedStoredMessage } from "@/components/grounded-learn-conversation";
import { IndustryEvidenceCard } from "@/components/industry-evidence-card";

type Props = {
  messages: GroundedStoredMessage[];
  courseId: string;
  materialId: string;
  conceptId: string;
  conversationId?: string;
  suggestions: string[];
};

export function GroundedLearnExperience(props: Props) {
  const [demonstration, setDemonstration] = useState<IndustryDemo | null>(null);
  function receiveDemonstration(value: unknown) {
    const parsed = industryDemoSchema.safeParse(value);
    setDemonstration(parsed.success ? parsed.data : null);
  }

  return <>
    {props.messages.length > 0 && <GroundedLearnConversation messages={props.messages} />}
    <IndustryEvidenceCard demonstration={demonstration} />
    <GroundedLearnComposer courseId={props.courseId} materialId={props.materialId} conceptId={props.conceptId}
      conversationId={props.conversationId} suggestions={props.suggestions} onIndustryDemonstration={receiveDemonstration} />
  </>;
}
