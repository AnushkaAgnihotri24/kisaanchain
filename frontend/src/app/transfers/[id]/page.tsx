"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState, PageHeader, Panel } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";

export default function TransferHistoryPage() {
  const params = useParams<{ id: string }>();
  const [batch, setBatch] = useState<any>(null);

  useEffect(() => {
    apiFetch<{ batch: any; currentOwner: any }>(`/batches/${params.id}`)
      .then((payload) => setBatch(payload.batch))
      .catch((error) => toast.error(error instanceof Error ? error.message : "Unable to load transfer history."));
  }, [params.id]);

  if (!batch) {
    return <EmptyState title="Loading transfer history" description="Fetching ownership records for this batch." />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Ownership transfer"
        title={`${batch.batchCode} | chain of custody`}
        description="Every recorded ownership transfer as the crop batch moves through the supply chain."
      />
      <Panel title="Transfer records" subtitle="Immutable ownership movement linked to the batch lifecycle.">
        {batch.transfers.length === 0 ? (
          <EmptyState title="No transfers yet" description="The batch is still with its originating farmer until the first transfer is recorded." />
        ) : (
          <div className="list-card">
            {batch.transfers.map((transfer: any) => (
              <div className="list-row" key={transfer.id}>
                <div>
                  <strong>
                    {transfer.fromUser.name} {"->"} {transfer.toUser.name}
                  </strong>
                  <small>
                    {transfer.fromUser.role} to {transfer.toUser.role}
                  </small>
                </div>
                <div>{transfer.details}</div>
                <div>{formatDate(transfer.createdAt)}</div>
                <div className="mono">{transfer.txHash ? `${transfer.txHash.slice(0, 12)}...` : "Pending"}</div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
