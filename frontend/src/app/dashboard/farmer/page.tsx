"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState, PageHeader, Panel, StatCard } from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch, uploadDocument } from "@/lib/api";
import { findEventArgs, writeContract } from "@/lib/contracts";
import { formatDate, toTitleCase } from "@/lib/format";

type Farm = {
  id: string;
  chainFarmId?: number | null;
  farmName: string;
  location: string;
  cropType: string;
};

type Batch = {
  id: string;
  chainBatchId?: number | null;
  batchCode: string;
  status: string;
  harvestDate: string;
  quantity: number;
  unit: string;
  qrVerification?: {
    qrDataUrl?: string | null;
  } | null;
  farm: {
    id: string;
    farmName: string;
  };
};

export default function FarmerDashboardPage() {
  const { user, token } = useAuth();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);

  async function loadData() {
    if (!user || !token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [farmPayload, batchPayload] = await Promise.all([
        apiFetch<{ farms: Farm[] }>(`/farms?ownerId=${user.id}`),
        apiFetch<{ batches: Batch[] }>("/batches")
      ]);

      setFarms(farmPayload.farms);
      setBatches(batchPayload.batches.filter((batch) => batch.farm?.id && farmPayload.farms.some((farm) => farm.id === batch.farm.id)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load farmer dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [user, token]);

  async function handleFarmCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const metadataUri = String(formData.get("metadataUri") || "");

    try {
      setWorking("farm");
      const chainResult = await writeContract("FarmRegistration", "registerFarm", [
        String(formData.get("farmName")),
        String(formData.get("location")),
        String(formData.get("cropType")),
        String(formData.get("geoCoordinates") || ""),
        Number(formData.get("areaHectares") || 0),
        metadataUri
      ]);

      const farmArgs = findEventArgs(chainResult.receipt, chainResult.contract, "FarmRegistered");

      await apiFetch(
        "/farms",
        {
          method: "POST",
          body: JSON.stringify({
            farmName: String(formData.get("farmName")),
            location: String(formData.get("location")),
            cropType: String(formData.get("cropType")),
            geoCoordinates: String(formData.get("geoCoordinates") || ""),
            areaHectares: Number(formData.get("areaHectares") || 0),
            metadataUri,
            chainFarmId: farmArgs ? Number(farmArgs[0]) : undefined,
            txHash: chainResult.txHash,
            chainId: chainResult.chainId
          })
        },
        token
      );

      toast.success("Farm registered on-chain and saved.");
      event.currentTarget.reset();
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to register farm.");
    } finally {
      setWorking(null);
    }
  }

  async function handleBatchCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const farm = farms.find((entry) => entry.id === String(formData.get("farmId")));

    if (!farm?.chainFarmId) {
      toast.error("The selected farm does not have a recorded on-chain farm ID yet.");
      return;
    }

    try {
      setWorking("batch");
      const chainResult = await writeContract("BatchCreation", "createBatch", [
        String(formData.get("batchCode")),
        farm.chainFarmId,
        Math.floor(new Date(String(formData.get("harvestDate"))).getTime() / 1000),
        Number(formData.get("quantity")),
        String(formData.get("unit")),
        String(formData.get("metadataUri") || "")
      ]);

      const batchArgs = findEventArgs(chainResult.receipt, chainResult.contract, "BatchCreated");

      await apiFetch(
        "/batches",
        {
          method: "POST",
          body: JSON.stringify({
            farmId: farm.id,
            batchCode: String(formData.get("batchCode")),
            harvestDate: new Date(String(formData.get("harvestDate"))).toISOString(),
            quantity: Number(formData.get("quantity")),
            unit: String(formData.get("unit")),
            metadataUri: String(formData.get("metadataUri") || ""),
            chainBatchId: batchArgs ? Number(batchArgs[0]) : undefined,
            txHash: chainResult.txHash,
            chainId: chainResult.chainId
          })
        },
        token
      );

      toast.success("Harvest batch created.");
      event.currentTarget.reset();
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create batch.");
    } finally {
      setWorking(null);
    }
  }

  async function handleTransformation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const batch = batches.find((entry) => entry.id === String(formData.get("batchId")));
    if (!batch?.chainBatchId) {
      toast.error("Select a batch with a valid on-chain batch ID.");
      return;
    }

    try {
      setWorking("transformation");
      const chainResult = await writeContract("BatchTransformation", "recordTransformation", [
        batch.chainBatchId,
        String(formData.get("transformationType")),
        String(formData.get("details")),
        String(formData.get("metadataUri") || "")
      ]);

      await apiFetch(
        `/batches/${batch.id}/transformations`,
        {
          method: "POST",
          body: JSON.stringify({
            transformationType: String(formData.get("transformationType")),
            details: String(formData.get("details")),
            metadataUri: String(formData.get("metadataUri") || ""),
            txHash: chainResult.txHash,
            chainId: chainResult.chainId
          })
        },
        token
      );

      toast.success("Transformation recorded.");
      event.currentTarget.reset();
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to record transformation.");
    } finally {
      setWorking(null);
    }
  }

  async function handleTraceEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const batch = batches.find((entry) => entry.id === String(formData.get("batchId")));
    if (!batch?.chainBatchId) {
      toast.error("Select a batch with a valid on-chain batch ID.");
      return;
    }

    try {
      setWorking("trace");
      const chainResult = await writeContract("Traceability", "recordManualEvent", [
        batch.chainBatchId,
        String(formData.get("eventType")),
        String(formData.get("details")),
        String(formData.get("metadataUri") || "")
      ]);

      await apiFetch(
        `/batches/${batch.id}/trace-events`,
        {
          method: "POST",
          body: JSON.stringify({
            eventType: String(formData.get("eventType")),
            details: String(formData.get("details")),
            metadataUri: String(formData.get("metadataUri") || ""),
            txHash: chainResult.txHash,
            chainId: chainResult.chainId
          })
        },
        token
      );

      toast.success("Traceability event recorded.");
      event.currentTarget.reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to record traceability event.");
    } finally {
      setWorking(null);
    }
  }

  async function handleCertificate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const batch = batches.find((entry) => entry.id === String(formData.get("batchId")));
    if (!batch?.chainBatchId) {
      toast.error("Select a batch with a valid on-chain batch ID.");
      return;
    }

    try {
      setWorking("certificate");
      const file = formData.get("document") as File | null;
      let cid = String(formData.get("documentCid") || "");

      if (file && file.size > 0) {
        const upload = await uploadDocument(file, token);
        cid = upload.cid;
      }

      const chainResult = await writeContract("CertificateVerification", "addCertificate", [
        batch.chainBatchId,
        String(formData.get("certificateType")),
        cid,
        String(formData.get("metadataUri") || "")
      ]);

      const certArgs = findEventArgs(chainResult.receipt, chainResult.contract, "CertificateAdded");

      await apiFetch(
        `/batches/${batch.id}/certificates`,
        {
          method: "POST",
          body: JSON.stringify({
            certificateType: String(formData.get("certificateType")),
            documentCid: cid,
            metadataUri: String(formData.get("metadataUri") || ""),
            chainCertificateId: certArgs ? Number(certArgs[0]) : undefined,
            txHashCreate: chainResult.txHash,
            chainId: chainResult.chainId
          })
        },
        token
      );

      toast.success("Certificate linked to the batch.");
      event.currentTarget.reset();
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add certificate.");
    } finally {
      setWorking(null);
    }
  }

  async function handleGenerateQr(batchId: string) {
    if (!token) {
      return;
    }

    try {
      setWorking(batchId);
      await apiFetch(
        `/batches/${batchId}/qrcode`,
        {
          method: "POST"
        },
        token
      );
      toast.success("QR verification token generated.");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to generate QR code.");
    } finally {
      setWorking(null);
    }
  }

  if (!user) {
    return <EmptyState title="Sign in required" description="Log in as a farmer to open this workspace." actionHref="/auth/login" actionLabel="Login" />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Farmer dashboard"
        title="Register origin, create saffron batches, and manage on-chain lifecycle records."
        description="This workspace follows the farmer journey in the report: verified farm origin, harvest batch creation, traceability updates, certificates, and QR generation."
      />

      <section className="stats-grid">
        <StatCard label="Approval" value={user.approvalStatus} hint="Admin verification unlocks protected actions." />
        <StatCard label="Wallet" value={user.walletAddress ? "Linked" : "Pending"} hint="Wallet is required for contract writes." />
        <StatCard label="Farms" value={farms.length} hint="Verified origin records you have registered." />
        <StatCard label="Batches" value={batches.length} hint="Harvest batches currently recorded in your workspace." />
      </section>

      <div className="dashboard-grid">
        <Panel title="Register farm" subtitle="Create a trusted saffron origin record through the Farm Registration contract.">
          <form className="form-grid" onSubmit={handleFarmCreate}>
            <div className="field">
              <label>Farm name</label>
              <input name="farmName" required placeholder="Pampore Saffron Estate" />
            </div>
            <div className="field">
              <label>Location</label>
              <input name="location" required placeholder="Pampore, Kashmir" />
            </div>
            <div className="field">
              <label>Crop type</label>
              <input name="cropType" defaultValue="Saffron" required />
            </div>
            <div className="field">
              <label>Area in hectares</label>
              <input name="areaHectares" type="number" step="0.01" placeholder="12.5" />
            </div>
            <div className="field">
              <label>Coordinates</label>
              <input name="geoCoordinates" placeholder="33.77,74.93" />
            </div>
            <div className="field">
              <label>Metadata URI</label>
              <input name="metadataUri" placeholder="ipfs://farm-metadata" />
            </div>
            <div className="button-row">
              <button className="primary-button" type="submit" disabled={working === "farm"}>
                {working === "farm" ? "Recording..." : "Register farm"}
              </button>
            </div>
          </form>
        </Panel>

        <Panel title="Create harvest batch" subtitle="Each batch receives a unique blockchain identity after harvest.">
          <form className="form-grid" onSubmit={handleBatchCreate}>
            <div className="field">
              <label>Farm</label>
              <select name="farmId" required defaultValue="">
                <option value="" disabled>
                  Select farm
                </option>
                {farms.map((farm) => (
                  <option key={farm.id} value={farm.id}>
                    {farm.farmName}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Batch code</label>
              <input name="batchCode" required placeholder="SAF-2026-001" />
            </div>
            <div className="field">
              <label>Harvest date</label>
              <input name="harvestDate" type="date" required />
            </div>
            <div className="field">
              <label>Quantity</label>
              <input name="quantity" type="number" step="0.01" required placeholder="500" />
            </div>
            <div className="field">
              <label>Unit</label>
              <input name="unit" defaultValue="grams" required />
            </div>
            <div className="field">
              <label>Metadata URI</label>
              <input name="metadataUri" placeholder="ipfs://batch-notes" />
            </div>
            <div className="button-row">
              <button className="primary-button" type="submit" disabled={working === "batch"}>
                {working === "batch" ? "Writing batch..." : "Create batch"}
              </button>
            </div>
          </form>
        </Panel>

        <Panel title="Transformation and packaging" subtitle="Record grading, cleaning, drying, or packaging milestones.">
          <form className="form-grid" onSubmit={handleTransformation}>
            <div className="field">
              <label>Batch</label>
              <select name="batchId" required defaultValue="">
                <option value="" disabled>
                  Select batch
                </option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batchCode}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Transformation type</label>
              <select name="transformationType" defaultValue="PACKAGING">
                <option value="GRADING">Grading</option>
                <option value="CLEANING">Cleaning</option>
                <option value="DRYING">Drying</option>
                <option value="PACKAGING">Packaging</option>
              </select>
            </div>
            <div className="field field--full">
              <label>Details</label>
              <textarea name="details" required placeholder="Describe the transformation step and its outcome." />
            </div>
            <div className="field">
              <label>Metadata URI</label>
              <input name="metadataUri" placeholder="ipfs://processing-note" />
            </div>
            <div className="button-row">
              <button className="primary-button" type="submit" disabled={working === "transformation"}>
                {working === "transformation" ? "Recording..." : "Add transformation"}
              </button>
            </div>
          </form>
        </Panel>

        <Panel title="Certificates and traceability" subtitle="Upload certificate documents and add standalone supply chain events.">
          <form className="form-grid" onSubmit={handleCertificate}>
            <div className="field">
              <label>Batch</label>
              <select name="batchId" required defaultValue="">
                <option value="" disabled>
                  Select batch
                </option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batchCode}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Certificate type</label>
              <input name="certificateType" required placeholder="GI Tag, Organic, Quality Assurance" />
            </div>
            <div className="field">
              <label>Document file</label>
              <input name="document" type="file" />
            </div>
            <div className="field">
              <label>Existing CID</label>
              <input name="documentCid" placeholder="bafy..." />
            </div>
            <div className="field field--full">
              <label>Metadata URI</label>
              <input name="metadataUri" placeholder="ipfs://certificate-meta" />
            </div>
            <div className="button-row">
              <button className="primary-button" type="submit" disabled={working === "certificate"}>
                {working === "certificate" ? "Linking..." : "Add certificate"}
              </button>
            </div>
          </form>

          <form className="form-grid" onSubmit={handleTraceEvent} style={{ marginTop: 20 }}>
            <div className="field">
              <label>Trace batch</label>
              <select name="batchId" required defaultValue="">
                <option value="" disabled>
                  Select batch
                </option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batchCode}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Event type</label>
              <input name="eventType" defaultValue="STORAGE" required />
            </div>
            <div className="field field--full">
              <label>Details</label>
              <textarea name="details" required placeholder="Packaging complete, cold storage logged, transport prepared..." />
            </div>
            <div className="button-row">
              <button className="ghost-button" type="submit" disabled={working === "trace"}>
                {working === "trace" ? "Writing trace..." : "Add trace event"}
              </button>
            </div>
          </form>
        </Panel>
      </div>

      <Panel title="Your recorded farms" subtitle="Origin records appear here once written through the real flow.">
        {loading ? (
          <p className="helper-text">Loading farms...</p>
        ) : farms.length === 0 ? (
          <EmptyState
            title="No farms yet"
            description="Register your first saffron farm to establish trusted origin before creating any batches."
          />
        ) : (
          <div className="list-card">
            {farms.map((farm) => (
              <div className="list-row" key={farm.id}>
                <div>
                  <strong>{farm.farmName}</strong>
                  <small>{farm.location}</small>
                </div>
                <div>{farm.cropType}</div>
                <div className="mono">Chain #{farm.chainFarmId ?? "pending"}</div>
                <div>
                  <Link href={`/farms/${farm.id}`} className="ghost-button">
                    View farm
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Your batches" subtitle="Batch history, QR generation, and lifecycle navigation live here.">
        {loading ? (
          <p className="helper-text">Loading batches...</p>
        ) : batches.length === 0 ? (
          <EmptyState
            title="No batches yet"
            description="After farm registration, create a harvested saffron batch and it will appear here."
          />
        ) : (
          <div className="list-card">
            {batches.map((batch) => (
              <div className="list-row" key={batch.id}>
                <div>
                  <strong>{batch.batchCode}</strong>
                  <small>
                    {batch.farm.farmName} | {formatDate(batch.harvestDate)}
                  </small>
                </div>
                <div>
                  {batch.quantity} {batch.unit}
                </div>
                <div>{toTitleCase(batch.status)}</div>
                <div className="button-row">
                  <Link href={`/batches/${batch.id}`} className="ghost-button">
                    Details
                  </Link>
                  <button className="secondary-button" onClick={() => handleGenerateQr(batch.id)} disabled={working === batch.id}>
                    {working === batch.id ? "Generating..." : "Generate QR"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
