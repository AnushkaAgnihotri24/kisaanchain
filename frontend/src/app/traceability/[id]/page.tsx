"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TraceabilityTimeline } from "@/components/traceability-timeline";
import { EmptyState, PageHeader, Panel } from "@/components/ui";
import { apiFetch } from "@/lib/api";

export default function TraceabilityPage() {
  const params = useParams<{ id: string }>();
  const [batch, setBatch] = useState<any>(null);

  useEffect(() => {
    apiFetch<{ batch: any }>(`/batches/${params.id}/traceability`)
      .then((payload) => setBatch(payload.batch))
      .catch((error) => toast.error(error instanceof Error ? error.message : "Unable to load traceability history."));
  }, [params.id]);

  if (!batch) {
    return <EmptyState title="Loading traceability" description="Fetching the chronological supply chain event history for this batch." />;
  }

  const timelineEvents = [
    ...batch.traceEvents.map((event: any) => ({
      id: event.id,
      eventType: event.eventType,
      details: event.details,
      occurredAt: event.occurredAt,
      actor: event.actor
    })),
    ...batch.transformations.map((event: any) => ({
      id: event.id,
      eventType: event.transformationType,
      details: event.details,
      createdAt: event.createdAt,
      actor: event.actor
    }))
  ].sort((left, right) => new Date(left.occurredAt || left.createdAt || 0).getTime() - new Date(right.occurredAt || right.createdAt || 0).getTime());

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Traceability"
        title={`${batch.batchCode} | end-to-end event history`}
        description="A full chronological view of batch transformations, logistics, certifications, and other traceability records."
      />
      <Panel title="Timeline" subtitle="Chronological history from creation onward.">
        <TraceabilityTimeline events={timelineEvents} />
      </Panel>
    </div>
  );
}
