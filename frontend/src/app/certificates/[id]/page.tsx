"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState, KeyValue, PageHeader, Panel } from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";
import { writeContract } from "@/lib/contracts";
import { formatDate } from "@/lib/format";

export default function CertificateDetailPage() {
  const params = useParams<{ id: string }>();
  const { user, token } = useAuth();
  const [certificate, setCertificate] = useState<any>(null);
  const [batch, setBatch] = useState<any>(null);
  const [working, setWorking] = useState(false);

  async function loadData() {
    try {
      const certificatePayload = await apiFetch<{ certificate: any }>(`/batches/certificates/${params.id}`);
      setCertificate(certificatePayload.certificate);
      const batchPayload = await apiFetch<{ batch: any; currentOwner: any }>(`/batches/${certificatePayload.certificate.batch.id}`);
      setBatch(batchPayload.batch);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load certificate.");
    }
  }

  useEffect(() => {
    void loadData();
  }, [params.id]);

  async function handleVerify() {
    if (!certificate || !batch?.chainBatchId || !token) {
      return;
    }

    const certificateIndex = batch.certificates.findIndex((entry: any) => entry.id === certificate.id);
    if (certificateIndex < 0) {
      toast.error("Unable to determine the certificate index for on-chain verification.");
      return;
    }

    try {
      setWorking(true);
      const chainResult = await writeContract("CertificateVerification", "verifyCertificate", [
        batch.chainBatchId,
        certificateIndex
      ]);

      await apiFetch(
        `/batches/certificates/${certificate.id}/verify`,
        {
          method: "POST",
          body: JSON.stringify({
            txHashVerify: chainResult.txHash,
            chainId: chainResult.chainId
          })
        },
        token
      );

      toast.success("Certificate verified.");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to verify certificate.");
    } finally {
      setWorking(false);
    }
  }

  if (!certificate) {
    return <EmptyState title="Loading certificate" description="Fetching certificate details and linked batch context." />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Certificate detail"
        title={certificate.certificateType}
        description="Certificate origin, document proof, linked batch context, and verification state."
      />
      <Panel title="Certificate overview" subtitle="Review the issuing authority, linked document, and current verification state.">
        <div className="detail-grid">
          <KeyValue label="Type" value={certificate.certificateType} />
          <KeyValue label="Status" value={certificate.isVerified ? "Verified" : "Pending"} />
          <KeyValue label="Issuer" value={certificate.issuer.name} />
          <KeyValue label="Verifier" value={certificate.verifier?.name || "Not yet verified"} />
          <KeyValue label="Document CID" value={certificate.documentCid} />
          <KeyValue label="Created" value={formatDate(certificate.createdAt)} />
        </div>
        {!certificate.isVerified && user && token && (user.role === "ADMIN" || user.role === "CERTIFIER") ? (
          <div className="button-row" style={{ marginTop: 18 }}>
            <button className="primary-button" onClick={handleVerify} disabled={working}>
              {working ? "Verifying..." : "Verify certificate on-chain"}
            </button>
          </div>
        ) : null}
      </Panel>
      <Panel title="Linked batch" subtitle="The certificate is attached to a specific saffron batch and origin farm.">
        <div className="detail-grid">
          <KeyValue label="Batch code" value={certificate.batch.batchCode} />
          <KeyValue label="Farm" value={certificate.batch.farm.farmName} />
          <KeyValue label="Location" value={certificate.batch.farm.location} />
          <KeyValue label="Farmer" value={certificate.batch.farmer.name} />
        </div>
      </Panel>
    </div>
  );
}
