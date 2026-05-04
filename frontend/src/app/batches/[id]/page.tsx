"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { TraceabilityTimeline } from "@/components/traceability-timeline";
import { EmptyState, KeyValue, PageHeader, Panel } from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";
import { writeContract } from "@/lib/contracts";
import { formatDate, toTitleCase } from "@/lib/format";

export default function BatchDetailPage() {
  const params = useParams<{ id: string }>();
  const { token } = useAuth();
  const [batch, setBatch] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [working, setWorking] = useState(false);

  async function loadData() {
    try {
      const [batchPayload, participantsPayload] = await Promise.all([
        apiFetch<{ batch: any; currentOwner: any }>(`/batches/${params.id}`),
        token ? apiFetch<{ participants: any[] }>("/participants?approvalStatus=APPROVED", undefined, token) : Promise.resolve({ participants: [] })
      ]);

      setBatch(batchPayload);
      setParticipants(participantsPayload.participants);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load batch.");
    }
  }

  useEffect(() => {
    void loadData();
  }, [params.id, token]);

  async function handleTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !batch?.batch?.chainBatchId) {
      toast.error("This batch is missing a recorded on-chain batch ID.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const recipient = participants.find((entry) => entry.id === String(formData.get("toUserId")));
    if (!recipient?.walletAddress) {
      toast.error("Select a verified participant with a linked wallet.");
      return;
    }

    try {
      setWorking(true);
      const details = String(formData.get("details"));
      const chainResult = await writeContract("OwnershipTransfer", "transferBatchOwnership", [
        batch.batch.chainBatchId,
        recipient.walletAddress,
        details
      ]);

      await apiFetch(
        `/batches/${batch.batch.id}/transfers`,
        {
          method: "POST",
          body: JSON.stringify({
            toUserId: recipient.id,
            details,
            txHash: chainResult.txHash,
            chainId: chainResult.chainId
          })
        },
        token
      );

      toast.success("Ownership transfer recorded.");
      event.currentTarget.reset();
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to transfer ownership.");
    } finally {
      setWorking(false);
    }
  }

  if (!batch) {
    return <EmptyState title="Loading batch" description="Fetching batch lifecycle and supporting records." />;
  }

  const record = batch.batch;
  const currentOwner = batch.currentOwner;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Batch detail"
        title={`${record.batchCode} | full crop lifecycle`}
        description="This view combines farm origin, certifications, transformations, transfers, escrow-linked orders, and QR verification state."
      />

      <Panel title="Batch snapshot" subtitle="Core identity, origin, and lifecycle status.">
        <div className="detail-grid">
          <KeyValue label="Batch code" value={record.batchCode} />
          <KeyValue label="Status" value={toTitleCase(record.status)} />
          <KeyValue label="Harvest date" value={formatDate(record.harvestDate)} />
          <KeyValue label="Quantity" value={`${record.quantity} ${record.unit}`} />
          <KeyValue label="Origin farm" value={record.farm.farmName} />
          <KeyValue label="Current owner" value={currentOwner?.name || "Unavailable"} />
        </div>
        <div className="button-row" style={{ marginTop: 18 }}>
          <Link href={`/traceability/${record.id}`} className="ghost-button">
            Trace timeline
          </Link>
          <Link href={`/transfers/${record.id}`} className="ghost-button">
            Transfer history
          </Link>
        </div>
      </Panel>

      <div className="panel-grid">
        <Panel title="Certificates" subtitle="Certificates linked to this batch and their verification state.">
          {record.certificates.length === 0 ? (
            <EmptyState title="No certificates linked" description="Use the farmer dashboard to upload real certificate documents for this batch." />
          ) : (
            <div className="list-card">
              {record.certificates.map((certificate: any) => (
                <div className="list-row" key={certificate.id}>
                  <div>
                    <strong>{certificate.certificateType}</strong>
                    <small>{certificate.issuer.name}</small>
                  </div>
                  <div>{certificate.isVerified ? "Verified" : "Pending"}</div>
                  <div>{formatDate(certificate.createdAt)}</div>
                  <div>
                    <Link href={`/certificates/${certificate.id}`} className="ghost-button">
                      View certificate
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Ownership transfer" subtitle="Transfer this batch to the next verified participant when conditions are met.">
          <form className="form-grid" onSubmit={handleTransfer}>
            <div className="field">
              <label>Transfer to</label>
              <select name="toUserId" required defaultValue="">
                <option value="" disabled>
                  Select verified participant
                </option>
                {participants
                  .filter((participant) => participant.id !== currentOwner?.id)
                  .map((participant) => (
                    <option key={participant.id} value={participant.id}>
                      {participant.name} | {participant.role}
                    </option>
                  ))}
              </select>
            </div>
            <div className="field field--full">
              <label>Transfer details</label>
              <textarea name="details" required placeholder="Transferred to retailer after escrow funding and packaging validation." />
            </div>
            <div className="button-row">
              <button className="primary-button" type="submit" disabled={working}>
                {working ? "Transferring..." : "Transfer ownership"}
              </button>
            </div>
          </form>
        </Panel>
      </div>

      <Panel title="Timeline" subtitle="Combined traceability and transformation history for this batch.">
        <TraceabilityTimeline
          events={[
            ...record.transformations.map((item: any) => ({
              id: item.id,
              eventType: item.transformationType,
              details: item.details,
              createdAt: item.createdAt,
              actor: item.actor
            })),
            ...record.traceEvents.map((item: any) => ({
              id: item.id,
              eventType: item.eventType,
              details: item.details,
              occurredAt: item.occurredAt,
              actor: item.actor
            }))
          ].sort((left, right) => new Date(left.occurredAt || left.createdAt || 0).getTime() - new Date(right.occurredAt || right.createdAt || 0).getTime())}
        />
      </Panel>
    </div>
  );
}
