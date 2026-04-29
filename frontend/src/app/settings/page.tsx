"use client";

import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { EmptyState, KeyValue, PageHeader, Panel } from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";

export default function SettingsPage() {
  const { user, token, refreshUser } = useAuth();
  const [saving, setSaving] = useState(false);

  async function handleProfileSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    const formData = new FormData(event.currentTarget);

    try {
      setSaving(true);
      await apiFetch(
        "/auth/profile",
        {
          method: "PATCH",
          body: JSON.stringify({
            name: String(formData.get("name")),
            organization: String(formData.get("organization")),
            location: String(formData.get("location")),
            bio: String(formData.get("bio"))
          })
        },
        token
      );
      await refreshUser();
      toast.success("Profile updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update profile.");
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return <EmptyState title="Sign in required" description="Log in to manage your KisaanChain profile and linked account details." actionHref="/auth/login" actionLabel="Login" />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Settings"
        title="Account profile, role status, and wallet-linked identity."
        description="Manage the account that powers JWT access, participant approval state, and blockchain-linked workflow permissions."
      />

      <Panel title="Profile summary" subtitle="Current account state used throughout the platform.">
        <div className="detail-grid">
          <KeyValue label="Name" value={user.name} />
          <KeyValue label="Email" value={user.email} />
          <KeyValue label="Role" value={user.role} />
          <KeyValue label="Approval status" value={user.approvalStatus} />
          <KeyValue label="Wallet" value={user.walletAddress || "Not linked"} />
          <KeyValue label="On-chain verification" value={user.isOnChainVerified ? "Verified" : "Pending"} />
        </div>
      </Panel>

      <Panel title="Edit profile" subtitle="Update supporting off-chain account metadata.">
        <form className="form-grid" onSubmit={handleProfileSave}>
          <div className="field">
            <label>Name</label>
            <input name="name" defaultValue={user.name} required />
          </div>
          <div className="field">
            <label>Organization</label>
            <input name="organization" defaultValue={user.organization || ""} />
          </div>
          <div className="field">
            <label>Location</label>
            <input name="location" defaultValue={user.location || ""} />
          </div>
          <div className="field field--full">
            <label>Bio</label>
            <textarea name="bio" defaultValue={user.bio || ""} />
          </div>
          <div className="button-row">
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save profile"}
            </button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
