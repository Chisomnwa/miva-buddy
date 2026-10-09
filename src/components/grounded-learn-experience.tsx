"use client";

import { useState } from "react";
import { industryDemoSchema, type IndustryDemo } from "@/contracts/industry-demo";
import { jobEvidenceResultSchema, type JobEvidenceResult } from "@/contracts/job-evidence";
import { GroundedLearnComposer } from "@/components/grounded-learn-composer";
import { GroundedLearnConversation, type GroundedStoredMessage } from "@/components/grounded-learn-conversation";
import { IndustryEvidenceCard } from "@/components/industry-evidence-card";
import { RemoteOkEvidence } from "@/components/remoteok-evidence";
import { HimalayasEvidence } from "@/components/himalayas-evidence";

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
  const [industryReferences, setIndustryReferences] = useState<JobEvidenceResult | null>(null);
  const [himalayasReferences, setHimalayasReferences] = useState<JobEvidenceResult | null>(null);
  function receiveDemonstration(value: unknown) {
    const parsed = industryDemoSchema.safeParse(value);
    setDemonstration(parsed.success ? parsed.data : null);
  }
  function receiveIndustryReferences(value: unknown) {
    const parsed = jobEvidenceResultSchema.safeParse(value);
    setIndustryReferences(parsed.success ? parsed.data : null);
  }
  function receiveHimalayasReferences(value: unknown) {
    const parsed = jobEvidenceResultSchema.safeParse(value);
    setHimalayasReferences(parsed.success ? parsed.data : null);
  }

  return <>
    {props.messages.length > 0 && <GroundedLearnConversation messages={props.messages} />}
    <RemoteOkEvidence result={industryReferences} />
    <HimalayasEvidence result={himalayasReferences} />
    <IndustryEvidenceCard demonstration={demonstration} />
    <GroundedLearnComposer courseId={props.courseId} materialId={props.materialId} conceptId={props.conceptId}
      conversationId={props.conversationId} suggestions={props.suggestions} onIndustryDemonstration={receiveDemonstration}
      onIndustryReferences={receiveIndustryReferences} onHimalayasReferences={receiveHimalayasReferences} />
  </>;
}
