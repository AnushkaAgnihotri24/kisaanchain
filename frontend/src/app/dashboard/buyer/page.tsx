"use client";

import Link from "next/link";
import { FormEvent, useDeferredValue, useEffect, useState } from "react";
import { parseEther } from "ethers";
import { toast } from "sonner";
import { EmptyState, PageHeader, Panel, StatCard } from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";
import { findEventArgs, writeContract } from "@/lib/contracts";
import { formatDate, toTitleCase } from "@/lib/format";

type Batch = {
  id: string;
  batchCode: string;
  status: string;
  quantity: number;
  unit: string;
  chainBatchId?: number | null;
  farm: {
    farmName: string;
    location: string;
  };
  farmer: {
    name: string;
    walletAddress?: string | null;
  };
  certificates: Array<{ isVerified: boolean }>;
};

type Order = {
  id: string;
  offeredAmount: number;
  amountWei: string;
  conditionNotes: string;
  status: string;
  createdAt: string;
  batch: {
    id: string;
    batchCode: string;
    chainBatchId?: number | null;
  };
  seller: {
    id: string;
    name: string;
    walletAddress?: string | null;
  };
  escrow?: {
    id: string;
    status: string;
  } | null;
};

export default function BuyerDashboardPage() {
  const { user, token } = useAuth();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [working, setWorking] = useState<string | null>(null);

  async function loadData() {
    if (!token) {
      return;
    }

    try {
      const [batchPayload, orderPayload] = await Promise.all([
        apiFetch<{ batches: Batch[] }>("/batches"),
        apiFetch<{ orders: Order[] }>("/orders", undefined, token)
      ]);

      setBatches(batchPayload.batches);
      setOrders(orderPayload.orders);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load retailer dashboard.");
    }
  }

  useEffect(() => {
    void loadData();
  }, [token]);

  async function handleCreateOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    const formData = new FormData(event.currentTarget);

    try {
      setWorking("order");
      await apiFetch(
        "/orders",
        {
          method: "POST",
          body: JSON.stringify({
            batchId: String(formData.get("batchId")),
            offeredAmount: Number(formData.get("offeredAmount")),
            amountWei: parseEther(String(formData.get("offeredAmount"))).toString(),
            conditionNotes: String(formData.get("conditionNotes"))
          })
        },
        token
      );

      toast.success("Retailer order created.");
      event.currentTarget.reset();
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create order.");
    } finally {
      setWorking(null);
    }
  }

  async function handleFundEscrow(order: Order) {
    if (!token) {
      return;
    }
    if (!order.batch.chainBatchId || !order.seller.walletAddress) {
      toast.error("This order is missing on-chain batch or seller wallet details.");
      return;
    }

    try {
      setWorking(order.id);
      const chainResult = await writeContract(
        "PaymentEscrow",
        "createEscrow",
        [order.batch.chainBatchId, order.seller.walletAddress, order.conditionNotes],
        String(order.offeredAmount)
      );

      const escrowArgs = findEventArgs(chainResult.receipt, chainResult.contract, "EscrowCreated");

      await apiFetch(
        `/orders/${order.id}/escrow`,
        {
          method: "POST",
          body: JSON.stringify({
            chainEscrowId: escrowArgs ? Number(escrowArgs[0]) : undefined,
            txHashCreate: chainResult.txHash,
            chainId: chainResult.chainId
          })
        },
        token
      );

      toast.success("Escrow funded.");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to fund escrow.");
    } finally {
      setWorking(null);
    }
  }

  const filteredBatches = batches.filter((batch) => {
    const term = deferredSearch.trim().toLowerCase();
    if (!term) {
      return true;
    }

    return (
      batch.batchCode.toLowerCase().includes(term) ||
      batch.farm.farmName.toLowerCase().includes(term) ||
      batch.farm.location.toLowerCase().includes(term)
    );
  });

  if (!user) {
    return <EmptyState title="Sign in required" description="Log in as a retailer to browse batches and fund escrow." actionHref="/auth/login" actionLabel="Login" />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Retailer dashboard"
        title="Review verified crop batches and move transactions into escrow."
        description="Browse traceable batches, inspect their certification state, open purchase orders, and fund escrow when transaction conditions are ready."
      />

      <section className="stats-grid">
        <StatCard label="Approval" value={user.approvalStatus} hint="Retailer approval and wallet access are required for escrow." />
        <StatCard label="Available batches" value={batches.length} hint="Batches currently visible in the marketplace-style browse view." />
        <StatCard label="Orders" value={orders.length} hint="Purchase workflows initiated from your account." />
        <StatCard label="Escrow-ready" value={orders.filter((order) => !order.escrow).length} hint="Orders that can still be funded on-chain." />
      </section>

      <div className="dashboard-grid">
        <Panel title="Search crop batches" subtitle="Filter by batch code, farm name, or location before entering a purchase flow.">
          <div className="field field--full">
            <label htmlFor="batch-search">Search</label>
            <input
              id="batch-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by batch code or origin farm"
            />
          </div>
          <div className="list-card">
            {filteredBatches.length === 0 ? (
              <EmptyState title="No batches match this search" description="Try a different batch code, farm name, or location." />
            ) : (
              filteredBatches.slice(0, 6).map((batch) => (
                <div className="list-row" key={batch.id}>
                  <div>
                    <strong>{batch.batchCode}</strong>
                    <small>
                      {batch.farm.farmName} | {batch.farm.location}
                    </small>
                  </div>
                  <div>
                    {batch.quantity} {batch.unit}
                  </div>
                  <div>{batch.certificates.some((certificate) => certificate.isVerified) ? "Verified" : "Pending"}</div>
                  <div>
                    <Link href={`/batches/${batch.id}`} className="ghost-button">
                      View batch
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel title="Initiate purchase workflow" subtitle="Create an off-chain retailer order before locking funds into the escrow contract.">
          <form className="form-grid" onSubmit={handleCreateOrder}>
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
              <label>Offer amount (ETH)</label>
              <input name="offeredAmount" type="number" step="0.0001" required placeholder="0.5" />
            </div>
            <div className="field field--full">
              <label>Conditions</label>
              <textarea
                name="conditionNotes"
                required
                placeholder="Release after ownership transfer, delivery validation, and certificate confirmation."
              />
            </div>
            <div className="button-row">
              <button className="primary-button" type="submit" disabled={working === "order"}>
                {working === "order" ? "Creating..." : "Create order"}
              </button>
            </div>
          </form>
        </Panel>
      </div>

      <Panel title="Your retailer orders" subtitle="Fund escrow for new orders, then continue settlement on the escrow detail page.">
        {orders.length === 0 ? (
          <EmptyState title="No orders yet" description="Create your first retailer order to start the settlement workflow." />
        ) : (
          <div className="list-card">
            {orders.map((order) => (
              <div className="list-row" key={order.id}>
                <div>
                  <strong>{order.batch.batchCode}</strong>
                  <small>
                    {order.seller.name} | {formatDate(order.createdAt)}
                  </small>
                </div>
                <div>{order.offeredAmount} ETH</div>
                <div>{toTitleCase(order.status)}</div>
                <div className="button-row">
                  {!order.escrow ? (
                    <button className="primary-button" onClick={() => handleFundEscrow(order)} disabled={working === order.id}>
                      {working === order.id ? "Funding..." : "Fund escrow"}
                    </button>
                  ) : (
                    <Link href={`/escrow/${order.escrow.id}`} className="ghost-button">
                      Open escrow
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
