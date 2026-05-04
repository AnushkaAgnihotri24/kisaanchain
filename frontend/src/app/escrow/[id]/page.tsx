"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState, KeyValue, PageHeader, Panel } from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";
import { writeContract } from "@/lib/contracts";
import { formatDate, toTitleCase } from "@/lib/format";

export default function EscrowDetailPage() {
  const params = useParams<{ id: string }>();
  const { user, token } = useAuth();
  const [escrow, setEscrow] = useState<any>(null);
  const [working, setWorking] = useState<string | null>(null);

  async function loadData() {
    if (!token) {
      return;
    }

    try {
      const payload = await apiFetch<{ escrow: any }>(`/orders/escrows/${params.id}`, undefined, token);
      setEscrow(payload.escrow);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load escrow.");
    }
  }

  useEffect(() => {
    void loadData();
  }, [params.id, token]);

  async function handleEscrowAction(action: "confirmDelivery" | "releaseEscrow" | "refundEscrow", apiPath: string) {
    if (!escrow?.chainEscrowId || !token) {
      toast.error("This escrow record is missing its on-chain escrow ID.");
      return;
    }

    try {
      setWorking(action);
      const chainResult = await writeContract("PaymentEscrow", action, [escrow.chainEscrowId]);
      await apiFetch(
        apiPath,
        {
          method: "POST",
          body: JSON.stringify({
            txHash: chainResult.txHash,
            chainId: chainResult.chainId
          })
        },
        token
      );
      toast.success("Escrow action completed.");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to complete escrow action.");
    } finally {
      setWorking(null);
    }
  }

  if (!escrow) {
    return <EmptyState title="Loading escrow" description="Fetching payment, retailer, seller, and resolution details." />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Escrow and settlement"
        title={`${escrow.order.batchCode ?? escrow.batch.batchCode} | payment flow`}
        description="Retailer-funded escrow stays locked until delivery and ownership conditions are fulfilled."
      />

      <Panel title="Escrow overview" subtitle="Settlement data from the off-chain order and on-chain escrow record.">
        <div className="detail-grid">
          <KeyValue label="Status" value={toTitleCase(escrow.status)} />
          <KeyValue label="Retailer" value={escrow.buyer.name} />
          <KeyValue label="Seller" value={escrow.seller.name} />
          <KeyValue label="Amount" value={`${escrow.amount} ETH`} />
          <KeyValue label="Created" value={formatDate(escrow.createdAt)} />
          <KeyValue label="Retailer confirmed" value={escrow.buyerConfirmedDelivery ? "Yes" : "No"} />
        </div>
      </Panel>

      <Panel title="Conditions" subtitle="The release path follows the report's requirement for secure, fair settlement.">
        <p>{escrow.conditionNotes}</p>
        <div className="button-row" style={{ marginTop: 18 }}>
          {user?.id === escrow.buyerId && escrow.status === "PENDING" && !escrow.buyerConfirmedDelivery ? (
            <button
              className="ghost-button"
              onClick={() => handleEscrowAction("confirmDelivery", `/orders/escrows/${escrow.id}/confirm-delivery`)}
              disabled={working === "confirmDelivery"}
            >
              {working === "confirmDelivery" ? "Confirming..." : "Confirm delivery"}
            </button>
          ) : null}

          {(user?.role === "ADMIN" || user?.id === escrow.buyerId) && escrow.status === "PENDING" ? (
            <button
              className="primary-button"
              onClick={() => handleEscrowAction("releaseEscrow", `/orders/escrows/${escrow.id}/release`)}
              disabled={working === "releaseEscrow"}
            >
              {working === "releaseEscrow" ? "Releasing..." : "Release escrow"}
            </button>
          ) : null}

          {user?.role === "ADMIN" && escrow.status === "PENDING" ? (
            <button
              className="ghost-button"
              onClick={() => handleEscrowAction("refundEscrow", `/orders/escrows/${escrow.id}/refund`)}
              disabled={working === "refundEscrow"}
            >
              {working === "refundEscrow" ? "Refunding..." : "Refund escrow"}
            </button>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}
