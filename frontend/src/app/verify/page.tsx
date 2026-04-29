"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { TraceabilityTimeline } from "@/components/traceability-timeline";
import { EmptyState, KeyValue, PageHeader, Panel } from "@/components/ui";
import { QrScanner } from "@/components/qr-scanner";
import { apiFetch } from "@/lib/api";
import { formatDate, toTitleCase } from "@/lib/format";

type VerifyPayload = {
  verified: boolean;
  authenticityStatus: string;
  summary: {
    originFarm: string;
    location: string;
    chainOfCustodySteps: number;
    traceEvents: number;
    verifiedCertificates: number;
  };
  currentOwner: {
    name: string;
    role?: string;
  };
  batch: {
    id: string;
    batchCode: string;
    status: string;
    harvestDate: string;
    quantity: number;
    unit: string;
    farm: {
      id: string;
      farmName: string;
      location: string;
      owner: {
        name: string;
      };
    };
    certificates: Array<{
      id: string;
      certificateType: string;
      isVerified: boolean;
      documentCid: string;
      issuer: { name: string };
      verifier?: { name: string } | null;
    }>;
    traceEvents: Array<{
      id: string;
      eventType: string;
      details: string;
      occurredAt: string;
      actor?: { name: string; role: string } | null;
    }>;
    transfers: Array<{
      id: string;
      details: string;
      createdAt: string;
      fromUser: { name: string; role: string };
      toUser: { name: string; role: string };
    }>;
    transformations: Array<{
      id: string;
      transformationType: string;
      details: string;
      createdAt: string;
      actor: { name: string; role: string };
    }>;
  };
};

function VerifyContent() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("token") || searchParams.get("batchCode") || "");
  const [mode, setMode] = useState<"token" | "batchCode">("token");
  const [result, setResult] = useState<VerifyPayload | null>(null);
  const [loading, setLoading] = useState(false);

  async function runLookup(nextQuery: string, nextMode: "token" | "batchCode") {
    if (!nextQuery.trim()) {
      return;
    }

    try {
      setLoading(true);
      const payload = await apiFetch<VerifyPayload>(`/verify?${nextMode}=${encodeURIComponent(nextQuery.trim())}`);
      setResult(payload);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification failed.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      void runLookup(token, "token");
    }
  }, [searchParams]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runLookup(query, mode);
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Consumer verification"
        title="Verify saffron authenticity by QR token or batch code."
        description="Consumers can scan a QR code or paste a batch identifier to inspect origin, certificates, processing history, transfers, and current authenticity status."
      />

      <div className="split-layout">
        <Panel title="Lookup" subtitle="Use camera scan when available, with manual fallback for every browser.">
          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="field">
              <label>Lookup mode</label>
              <select value={mode} onChange={(event) => setMode(event.target.value as "token" | "batchCode")}>
                <option value="token">QR token</option>
                <option value="batchCode">Batch code</option>
              </select>
            </div>
            <div className="field field--full">
              <label>Token or batch code</label>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Paste QR token or batch code" />
            </div>
            <div className="button-row">
              <button className="primary-button" type="submit" disabled={loading}>
                {loading ? "Verifying..." : "Verify product"}
              </button>
            </div>
          </form>
          <div style={{ marginTop: 18 }}>
            <QrScanner
              onScan={(decodedText) => {
                try {
                  const url = new URL(decodedText);
                  const token = url.searchParams.get("token");
                  if (token) {
                    setMode("token");
                    setQuery(token);
                    void runLookup(token, "token");
                    return;
                  }
                } catch {}

                setMode("batchCode");
                setQuery(decodedText);
                void runLookup(decodedText, "batchCode");
              }}
            />
          </div>
        </Panel>

        <Panel title="Verification guidance" subtitle="The product remains empty until real batches and QR tokens are created.">
          <div className="timeline">
            {[
              "A farmer creates a real saffron batch after harvest.",
              "Certificates are uploaded and optionally verified by an authority.",
              "Transformations and transfers extend the chain of custody.",
              "A QR token is generated for the batch from the farmer dashboard.",
              "The consumer scans or pastes that token here to verify authenticity."
            ].map((step) => (
              <article className="timeline-item" key={step}>
                <span className="timeline-item__dot" />
                <div>
                  <strong>{step}</strong>
                </div>
              </article>
            ))}
          </div>
        </Panel>
      </div>

      {!result ? (
        <EmptyState
          title="No product verified yet"
          description="Scan a QR code or paste a batch code to inspect an actual saffron batch once one has been recorded."
        />
      ) : (
        <>
          <Panel title="Authenticity snapshot" subtitle="Consumer-facing batch status, origin, and proof summary.">
            <div className="detail-grid">
              <KeyValue label="Authenticity status" value={result.authenticityStatus} />
              <KeyValue label="Current owner" value={result.currentOwner?.name || "Unavailable"} />
              <KeyValue label="Origin farm" value={result.summary.originFarm} />
              <KeyValue label="Location" value={result.summary.location} />
              <KeyValue label="Verified certificates" value={result.summary.verifiedCertificates} />
              <KeyValue label="Trace events" value={result.summary.traceEvents} />
            </div>
            <div className="button-row" style={{ marginTop: 18 }}>
              <Link href={`/batches/${result.batch.id}`} className="ghost-button">
                Open batch detail
              </Link>
              <Link href={`/traceability/${result.batch.id}`} className="ghost-button">
                View trace timeline
              </Link>
            </div>
          </Panel>

          <div className="panel-grid">
            <Panel title="Batch and origin" subtitle="Core batch information visible to buyers and consumers.">
              <div className="detail-grid">
                <KeyValue label="Batch code" value={result.batch.batchCode} />
                <KeyValue label="Harvest date" value={formatDate(result.batch.harvestDate)} />
                <KeyValue label="Quantity" value={`${result.batch.quantity} ${result.batch.unit}`} />
                <KeyValue label="Status" value={toTitleCase(result.batch.status)} />
                <KeyValue label="Farm" value={result.batch.farm.farmName} />
                <KeyValue label="Farmer" value={result.batch.farm.owner.name} />
              </div>
            </Panel>

            <Panel title="Certificates" subtitle="Only verified certificates should contribute to authenticity confidence.">
              {result.batch.certificates.length === 0 ? (
                <EmptyState title="No certificates linked" description="This batch does not currently have any uploaded certificates." />
              ) : (
                <div className="list-card">
                  {result.batch.certificates.map((certificate) => (
                    <div className="list-row" key={certificate.id}>
                      <div>
                        <strong>{certificate.certificateType}</strong>
                        <small>{certificate.issuer.name}</small>
                      </div>
                      <div>{certificate.isVerified ? "Verified" : "Pending"}</div>
                      <div className="mono">{certificate.documentCid.slice(0, 14)}...</div>
                      <div>
                        <Link href={`/certificates/${certificate.id}`} className="ghost-button">
                          Open
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <Panel title="Traceability timeline" subtitle="Chronological supply chain events, transformations, and verification steps.">
            <TraceabilityTimeline
              events={[
                ...result.batch.transformations.map((item) => ({
                  id: item.id,
                  eventType: item.transformationType,
                  details: item.details,
                  occurredAt: item.createdAt,
                  actor: item.actor
                })),
                ...result.batch.traceEvents.map((item) => ({
                  id: item.id,
                  eventType: item.eventType,
                  details: item.details,
                  occurredAt: item.occurredAt,
                  actor: item.actor || undefined
                }))
              ].sort(
                (left, right) =>
                  new Date(left.occurredAt || 0).getTime() - new Date(right.occurredAt || 0).getTime()
              )}
            />
          </Panel>
        </>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<EmptyState title="Loading verification view" description="Preparing QR verification and manual lookup tools." />}>
      <VerifyContent />
    </Suspense>
  );
}
