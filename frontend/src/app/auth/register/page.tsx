"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      setSubmitting(true);
      await register({
        name: String(formData.get("name")),
        email: String(formData.get("email")),
        password: String(formData.get("password")),
        role: String(formData.get("role")) as "ADMIN" | "FARMER" | "BUYER" | "CONSUMER" | "CERTIFIER",
        organization: String(formData.get("organization") || ""),
        location: String(formData.get("location") || "")
      });
      toast.success("Account created.");
      router.push("/onboarding");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="split-layout">
      <div className="page-stack">
        <PageHeader
          eyebrow="Get started"
          title="Create a role-based KisaanChain account."
          description="Register with email and password first, then link your wallet and submit your blockchain participant request."
        />
      </div>

      <Panel title="Register" subtitle="The platform starts clean, so every participant enters through real approval flows.">
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input id="name" name="name" required placeholder="Your name" />
          </div>
          <div className="field">
            <label htmlFor="role">Role</label>
            <select id="role" name="role" defaultValue="FARMER">
              <option value="FARMER">Farmer</option>
              <option value="BUYER">Buyer</option>
              <option value="CONSUMER">Consumer</option>
              <option value="CERTIFIER">Certification authority</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required placeholder="you@example.com" />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" minLength={8} required />
          </div>
          <div className="field">
            <label htmlFor="organization">Organization</label>
            <input id="organization" name="organization" placeholder="Farm, company, or certifying body" />
          </div>
          <div className="field">
            <label htmlFor="location">Location</label>
            <input id="location" name="location" placeholder="Region or district" />
          </div>
          <div className="button-row">
            <button className="primary-button" type="submit" disabled={submitting}>
              {submitting ? "Creating account..." : "Create account"}
            </button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
