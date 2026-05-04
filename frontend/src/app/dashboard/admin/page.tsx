"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState, PageHeader, Panel, StatCard } from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";
import { writeContract } from "@/lib/contracts";
import { formatDate, roleLabel, shortAddress } from "@/lib/format";

type Participant = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "FARMER" | "BUYER" | "CONSUMER" | "CERTIFIER";
  approvalStatus?: string;
  walletAddress?: string | null;
  participantMeta?: string | null;
  createdAt: string;
};

type Certificate = {
  id: string;
  certificateType: string;
  isVerified: boolean;
  createdAt: string;
  batch: {
    id: string;
    batchCode: string;
  };
  issuer: {
    name: string;
  };
};

type Transaction = {
  txHash: string;
  contractName: string;
  methodName: string;
  status: string;
  createdAt: string;
};

export default function AdminDashboardPage() {
  const { user, token } = useAuth();
  const [pendingParticipants, setPendingParticipants] = useState<Participant[]>([]);
  const [retailers, setRetailers] = useState<Participant[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [working, setWorking] = useState<string | null>(null);

  async function loadData() {
    if (!token) {
      return;
    }

    try {
      const [pendingPayload, participantsPayload, certificatesPayload, transactionsPayload] = await Promise.all([
        apiFetch<{ participants: Participant[] }>("/participants/pending", undefined, token),
        apiFetch<{ participants: Participant[] }>("/participants?role=BUYER&approvalStatus=APPROVED", undefined, token),
        apiFetch<{ certificates: Certificate[] }>("/batches/certificates?status=unverified"),
        apiFetch<{ transactions: Transaction[] }>("/transactions", undefined, token)
      ]);

      setPendingParticipants(pendingPayload.participants);
      setRetailers(participantsPayload.participants);
      setCertificates(certificatesPayload.certificates);
      setTransactions(transactionsPayload.transactions);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load admin dashboard.");
    }
  }

  useEffect(() => {
    void loadData();
  }, [token]);

  async function handleParticipantApproval(participant: Participant, approved: boolean) {
    if (!token) {
      return;
    }
    if (!participant.walletAddress) {
      toast.error("The participant must link a wallet before on-chain approval.");
      return;
    }

    try {
      setWorking(participant.id);
      const chainResult = await writeContract("ParticipantRegistry", "verifyParticipant", [
        participant.walletAddress,
        approved,
        approved ? "Approved by KisaanChain admin" : "Rejected by KisaanChain admin"
      ]);

      await apiFetch(
        `/participants/${participant.id}/approve`,
        {
          method: "POST",
          body: JSON.stringify({
            approved,
            notes: approved ? "Approved by admin" : "Rejected by admin",
            txHash: chainResult.txHash,
            chainId: chainResult.chainId
          })
        },
        token
      );

      toast.success(`Participant ${approved ? "approved" : "rejected"}.`);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update participant.");
    } finally {
      setWorking(null);
    }
  }

  async function handleBuyerRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const buyer = retailers.find((entry) => entry.id === String(formData.get("buyerId")));

    if (!buyer?.walletAddress) {
      toast.error("Select a retailer with a linked wallet.");
      return;
    }

    try {
      setWorking("buyer-rule");
      const maxActiveEscrows = Number(formData.get("maxActiveEscrows") || 1);
      const notes = String(formData.get("notes") || "");

      const chainResult = await writeContract("BuyerEnforcement", "setBuyerRule", [
        buyer.walletAddress,
        true,
        true,
        maxActiveEscrows,
        notes
      ]);

      await apiFetch(
        "/transactions",
        {
          method: "POST",
          body: JSON.stringify({
            userId: buyer.id,
            resourceType: "retailer-rule",
            resourceId: buyer.id,
            contractName: "BuyerEnforcement",
            methodName: "setBuyerRule",
            txHash: chainResult.txHash,
            chainId: chainResult.chainId,
            status: "CONFIRMED",
            metadataJson: {
              maxActiveEscrows,
              notes
            }
          })
        },
        token
      );

      toast.success("Retailer compliance rule recorded.");
      event.currentTarget.reset();
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to apply retailer rule.");
    } finally {
      setWorking(null);
    }
  }

  if (!user) {
    return <EmptyState title="Sign in required" description="Log in as an admin to manage participants and approvals." actionHref="/auth/login" actionLabel="Login" />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Admin dashboard"
        title="Approve participants, monitor certificates, and oversee blockchain activity."
        description="This workspace covers the report's administrator journey: participant verification, compliance control, certificate review, and traceability oversight."
      />

      <section className="stats-grid">
        <StatCard label="Pending approvals" value={pendingParticipants.length} hint="Participants waiting for admin verification." />
        <StatCard label="Approved retailers" value={retailers.length} hint="Retailers eligible for compliance rule configuration." />
        <StatCard label="Unverified certificates" value={certificates.length} hint="Certificates still awaiting review." />
        <StatCard label="Tracked transactions" value={transactions.length} hint="Backend transaction records across contracts." />
      </section>

      <div className="dashboard-grid">
        <Panel title="Pending participant approvals" subtitle="Approve or reject wallet-linked supply chain participants.">
          {pendingParticipants.length === 0 ? (
            <EmptyState title="No pending participants" description="New role requests will appear here for admin review." />
          ) : (
            <div className="list-card">
              {pendingParticipants.map((participant) => (
                <div className="list-row" key={participant.id}>
                  <div>
                    <strong>{participant.name}</strong>
                    <small>
                      {roleLabel(participant.role)} | {participant.email}
                    </small>
                  </div>
                  <div>{shortAddress(participant.walletAddress)}</div>
                  <div>{formatDate(participant.createdAt)}</div>
                  <div className="button-row">
                    <button
                      className="primary-button"
                      onClick={() => handleParticipantApproval(participant, true)}
                      disabled={working === participant.id}
                    >
                      Approve
                    </button>
                    <button
                      className="ghost-button"
                      onClick={() => handleParticipantApproval(participant, false)}
                      disabled={working === participant.id}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Retailer enforcement rules" subtitle="Apply on-chain compliance conditions before purchases can complete.">
          <form className="form-grid" onSubmit={handleBuyerRule}>
            <div className="field">
              <label>Retailer</label>
              <select name="buyerId" required defaultValue="">
                <option value="" disabled>
                  Select approved retailer
                </option>
                {retailers.map((buyer) => (
                  <option key={buyer.id} value={buyer.id}>
                    {buyer.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Max active escrows</label>
              <input name="maxActiveEscrows" type="number" min="1" defaultValue="3" required />
            </div>
            <div className="field field--full">
              <label>Notes</label>
              <textarea name="notes" placeholder="Compliance notes, retailer conditions, or settlement instructions." />
            </div>
            <div className="button-row">
              <button className="primary-button" type="submit" disabled={working === "buyer-rule"}>
                {working === "buyer-rule" ? "Applying..." : "Apply retailer rule"}
              </button>
            </div>
          </form>
        </Panel>
      </div>

      <Panel title="Certificate review queue" subtitle="Open each certificate to inspect the linked batch, issuer, and verification context.">
        {certificates.length === 0 ? (
          <EmptyState title="No certificates awaiting review" description="Once farmers or certifiers upload batch certificates, they will appear here." />
        ) : (
          <div className="list-card">
            {certificates.map((certificate) => (
              <div className="list-row" key={certificate.id}>
                <div>
                  <strong>{certificate.certificateType}</strong>
                  <small>
                    {certificate.batch.batchCode} | {certificate.issuer.name}
                  </small>
                </div>
                <div>{certificate.isVerified ? "Verified" : "Pending"}</div>
                <div>{formatDate(certificate.createdAt)}</div>
                <div>
                  <Link href={`/certificates/${certificate.id}`} className="ghost-button">
                    Review certificate
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Recent blockchain activity" subtitle="Monitor cross-contract transaction flow from the backend ledger.">
        {transactions.length === 0 ? (
          <EmptyState title="No transactions yet" description="As participants start using the platform, transactions will appear here." />
        ) : (
          <div className="list-card">
            {transactions.slice(0, 8).map((transaction) => (
              <div className="list-row" key={transaction.txHash}>
                <div>
                  <strong>{transaction.contractName}</strong>
                  <small>{transaction.methodName}</small>
                </div>
                <div>{transaction.status}</div>
                <div>{formatDate(transaction.createdAt)}</div>
                <div className="mono">{transaction.txHash.slice(0, 12)}...</div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
