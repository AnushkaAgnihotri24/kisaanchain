"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { PageHeader, Panel, StatCard } from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";
import { roleToContractEnum, writeContract } from "@/lib/contracts";

const dashboardHref = {
  FARMER: "/dashboard/farmer",
  ADMIN: "/dashboard/admin",
  BUYER: "/dashboard/buyer",
  CONSUMER: "/verify",
  CERTIFIER: "/dashboard/admin"
} as const;

export default function OnboardingPage() {
  const { user, token, refreshUser } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  async function handleParticipantRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !token) {
      toast.error("Log in before submitting a participant request.");
      return;
    }
    if (!user.walletAddress) {
      toast.error("Link your wallet from the header before writing to the blockchain.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const participantMeta = String(formData.get("participantMeta"));

    try {
      setSubmitting(true);
      const chainResult = await writeContract("ParticipantRegistry", "requestRegistration", [
        roleToContractEnum[user.role],
        user.name,
        user.email,
        participantMeta
      ]);

      await apiFetch(
        "/participants/request",
        {
          method: "POST",
          body: JSON.stringify({
            participantMeta,
            txHash: chainResult.txHash,
            chainId: chainResult.chainId
          })
        },
        token
      );

      await refreshUser();
      toast.success("Participant request recorded on-chain and in the backend.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to submit participant request.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) {
    return (
      <Panel title="Authentication required" subtitle="Create an account or sign in to continue.">
        <div className="button-row">
          <Link href="/auth/login" className="primary-button">
            Login
          </Link>
          <Link href="/auth/register" className="ghost-button">
            Register
          </Link>
        </div>
      </Panel>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Onboarding"
        title="Prepare your role for blockchain participation."
        description="JWT account access, wallet linking, and participant approval work together here before role-specific actions become available."
      />

      <section className="stats-grid">
        <StatCard label="Role" value={user.role} hint="Role-specific permissions shape dashboard access." />
        <StatCard
          label="Approval"
          value={user.approvalStatus}
          hint="Farmers, buyers, and certifiers need approval before protected actions."
        />
        <StatCard
          label="Wallet"
          value={user.walletAddress ? "Linked" : "Pending"}
          hint="Use the header wallet button to connect MetaMask."
        />
        <StatCard
          label="Next step"
          value={user.approvalStatus === "APPROVED" ? "Enter dashboard" : "Submit request"}
          hint="Once approved, continue with your role-specific workspace."
        />
      </section>

      <div className="split-layout">
        <Panel title="Role request" subtitle="Submit your participant metadata to the Participant Registry contract.">
          <form className="form-grid" onSubmit={handleParticipantRequest}>
            <div className="field field--full">
              <label htmlFor="participantMeta">Participant metadata URI or note</label>
              <textarea
                id="participantMeta"
                name="participantMeta"
                defaultValue={user.organization || user.location || ""}
                placeholder="ipfs://participant-profile or structured organizational notes"
                required
              />
            </div>
            <div className="button-row">
              <button className="primary-button" type="submit" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit participant request"}
              </button>
            </div>
          </form>
        </Panel>

        <Panel title="Continue" subtitle="Jump to the workspace that matches your role.">
          <div className="timeline">
            {[
              "Link wallet from the header.",
              "Submit participant request to the blockchain.",
              "Wait for admin approval if your role requires verification.",
              "Enter the dashboard and start recording real supply chain data."
            ].map((step) => (
              <article className="timeline-item" key={step}>
                <span className="timeline-item__dot" />
                <div>
                  <strong>{step}</strong>
                </div>
              </article>
            ))}
          </div>
          <div className="button-row">
            <Link href={dashboardHref[user.role]} className="ghost-button">
              Open your role dashboard
            </Link>
            <Link href="/verify" className="ghost-button">
              Open verification view
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}
