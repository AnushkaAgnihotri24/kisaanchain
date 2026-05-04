"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState, PageHeader, Panel } from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";

export default function TransactionsPage() {
  const { token } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    if (!token) {
      return;
    }

    apiFetch<{ transactions: any[] }>("/transactions", undefined, token)
      .then((payload) => setTransactions(payload.transactions))
      .catch((error) => toast.error(error instanceof Error ? error.message : "Unable to load transactions."));
  }, [token]);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Blockchain transactions"
        title="Tracked contract activity across KisaanChain."
        description="The backend records transaction references for participant approvals, farm registration, batches, certificates, transfers, traceability, retailer enforcement, and escrow."
      />
      <Panel title="Transaction ledger" subtitle="Recent blockchain interactions recorded by the backend.">
        {transactions.length === 0 ? (
          <EmptyState title="No transactions recorded yet" description="Once contract actions begin, their hashes and statuses will appear here." />
        ) : (
          <div className="list-card">
            {transactions.map((transaction) => (
              <div className="list-row" key={transaction.txHash}>
                <div>
                  <strong>{transaction.contractName}</strong>
                  <small>{transaction.methodName}</small>
                </div>
                <div>{transaction.status}</div>
                <div>{formatDate(transaction.createdAt)}</div>
                <div className="mono">{transaction.txHash.slice(0, 14)}...</div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
