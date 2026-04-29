"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type User = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "FARMER" | "BUYER" | "CONSUMER" | "CERTIFIER";
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  walletAddress?: string | null;
  organization?: string | null;
  location?: string | null;
  bio?: string | null;
  isOnChainVerified?: boolean;
};

type AuthContextValue = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    name: string;
    email: string;
    password: string;
    role: User["role"];
    organization?: string;
    location?: string;
  }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  setSession: (token: string, user: User) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const storageKey = "kisaanchain-session";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      setLoading(false);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as { token: string; user: User };
      setToken(parsed.token);
      setUser(parsed.user);
    } catch {
      window.localStorage.removeItem(storageKey);
    } finally {
      setLoading(false);
    }
  }, []);

  function setSession(nextToken: string, nextUser: User) {
    setToken(nextToken);
    setUser(nextUser);
    window.localStorage.setItem(storageKey, JSON.stringify({ token: nextToken, user: nextUser }));
  }

  async function refreshUser() {
    if (!token) {
      return;
    }

    const payload = await apiFetch<{ user: User }>("/auth/me", undefined, token);
    setUser(payload.user);
    window.localStorage.setItem(storageKey, JSON.stringify({ token, user: payload.user }));
  }

  async function login(email: string, password: string) {
    const payload = await apiFetch<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    setSession(payload.token, payload.user);
  }

  async function register(payload: {
    name: string;
    email: string;
    password: string;
    role: User["role"];
    organization?: string;
    location?: string;
  }) {
    const response = await apiFetch<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    setSession(response.token, response.user);
  }

  function logout() {
    setToken(null);
    setUser(null);
    window.localStorage.removeItem(storageKey);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser, setSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
