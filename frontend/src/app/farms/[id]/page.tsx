"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState, KeyValue, PageHeader, Panel } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";

export default function FarmDetailPage() {
  const params = useParams<{ id: string }>();
  const [farm, setFarm] = useState<any>(null);

  useEffect(() => {
    apiFetch<{ farm: any }>(`/farms/${params.id}`)
      .then((payload) => setFarm(payload.farm))
      .catch((error) => toast.error(error instanceof Error ? error.message : "Unable to load farm."));
  }, [params.id]);

  if (!farm) {
    return <EmptyState title="Loading farm" description="Fetching farm origin details and linked batches." />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Farm detail"
        title={farm.farmName}
        description="Trusted origin record for saffron production, including location, crop type, owner, and linked batches."
      />
      <Panel title="Origin profile" subtitle="Farm metadata captured during registration.">
        <div className="detail-grid">
          <KeyValue label="Farm name" value={farm.farmName} />
          <KeyValue label="Location" value={farm.location} />
          <KeyValue label="Crop type" value={farm.cropType} />
          <KeyValue label="Owner" value={farm.owner.name} />
          <KeyValue label="On-chain farm ID" value={farm.chainFarmId ?? "Pending"} />
          <KeyValue label="Created" value={formatDate(farm.createdAt)} />
        </div>
      </Panel>
      <Panel title="Linked batches" subtitle="Harvested saffron batches originating from this farm.">
        {farm.batches.length === 0 ? (
          <EmptyState title="No farm batches yet" description="Create the first harvested saffron batch to build this farm's history." />
        ) : (
          <div className="list-card">
            {farm.batches.map((batch: any) => (
              <div className="list-row" key={batch.id}>
                <div>
                  <strong>{batch.batchCode}</strong>
                  <small>{formatDate(batch.harvestDate)}</small>
                </div>
                <div>
                  {batch.quantity} {batch.unit}
                </div>
                <div>{batch.status}</div>
                <div>
                  <Link href={`/batches/${batch.id}`} className="ghost-button">
                    View batch
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
