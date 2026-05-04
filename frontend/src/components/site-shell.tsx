"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { connectWallet } from "@/lib/contracts";
import { roleLabel, shortAddress } from "@/lib/format";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/about", label: "How it works" },
  { href: "/verify", label: "Verify" },
  { href: "/dashboard/farmer", label: "Farmer" },
  { href: "/dashboard/admin", label: "Admin" },
  { href: "/dashboard/buyer", label: "Retailer" }
];

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, token, logout, refreshUser } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [linkingWallet, setLinkingWallet] = useState(false);

  async function handleWalletLink() {
    if (!token) {
      toast.error("Log in first to link your wallet.");
      return;
    }

    try {
      setLinkingWallet(true);
      const wallet = await connectWallet();
      await apiFetch(
        "/auth/link-wallet",
        {
          method: "POST",
          body: JSON.stringify({ walletAddress: wallet.address })
        },
        token
      );
      await refreshUser();
      toast.success("Wallet linked successfully.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to link wallet.");
    } finally {
      setLinkingWallet(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-header__inner">
          <Link href="/" className="brand-mark">
            <span className="brand-mark__glyph">KC</span>
            <span>
              KisaanChain
              <small>Crop traceability on Ethereum</small>
            </span>
          </Link>

          <nav className={`site-nav ${menuOpen ? "site-nav--open" : ""}`}>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={pathname === item.href ? "nav-link nav-link--active" : "nav-link"}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="header-actions">
            {user ? (
              <>
                <button className="ghost-button" onClick={handleWalletLink} disabled={linkingWallet}>
                  <Wallet size={16} />
                  {user.walletAddress ? `Change wallet ${shortAddress(user.walletAddress)}` : "Connect MetaMask"}
                </button>
                <Link className="ghost-button" href="/settings">
                  {roleLabel(user.role)}
                </Link>
                <button className="primary-button" onClick={logout}>
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link className="ghost-button" href="/auth/login">
                  Login
                </Link>
                <Link className="primary-button" href="/auth/register">
                  Get started
                </Link>
              </>
            )}
            <button className="menu-button" onClick={() => setMenuOpen((value) => !value)} aria-label="Toggle menu">
              <Menu size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="page-main">{children}</main>

      <footer className="site-footer">
        <div>
          <strong>KisaanChain</strong>
          <p>Farm registration, batch traceability, certification verification, escrow, and consumer trust.</p>
        </div>
        <div className="footer-links">
          <Link href="/verify">Verify product</Link>
          <Link href="/transactions">Transactions</Link>
          <Link href="/settings">Settings</Link>
        </div>
      </footer>
    </div>
  );
}
