"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      setSubmitting(true);
      await login(String(formData.get("email")), String(formData.get("password")));
      toast.success("Welcome back.");
      router.push("/onboarding");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to log in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="split-layout">
      <div className="page-stack">
        <PageHeader
          eyebrow="Authentication"
          title="Sign in to continue your KisaanChain workflow."
          description="Access your role-specific dashboard, connect a wallet, and continue the blockchain traceability flow."
        />
      </div>

      <Panel title="Login" subtitle="JWT-based account access with wallet linking handled after sign-in.">
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field field--full">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required placeholder="you@example.com" />
          </div>
          <div className="field field--full">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required placeholder="Your secure password" />
          </div>
          <div className="button-row">
            <button className="primary-button" type="submit" disabled={submitting}>
              {submitting ? "Signing in..." : "Sign in"}
            </button>
            <Link href="/auth/register" className="ghost-button">
              Create account
            </Link>
          </div>
        </form>
      </Panel>
    </div>
  );
}
