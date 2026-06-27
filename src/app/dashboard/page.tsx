"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { LogIn, Receipt } from "lucide-react";
import { getCurrencyScale } from "@/lib/checkout/currency";

interface Session {
  id: string;
  status: string;
  amount_total: number | null;
  currency: string;
  mode: string;
  created_at: string;
  completed_at: string | null;
  customer_wallet: string | null;
}

function formatAmount(amount: number, currency: string): string {
  const scale = getCurrencyScale(currency);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: scale,
  }).format(amount / Math.pow(10, scale));
}

export default function DashboardPage() {
  const [authState, setAuthState] = useState<
    "checking" | "signed-out" | "signed-in"
  >("checking");
  const [apiKey, setApiKey] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/dashboard/sessions?limit=50", {
        cache: "no-store",
      });
      if (response.status === 401) {
        setAuthState("signed-out");
        return;
      }
      if (!response.ok) throw new Error("Could not load transactions");
      const data = await response.json();
      setSessions(data.data || []);
      setError("");
    } catch {
      setError("Could not load transactions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const response = await fetch("/api/dashboard/session", {
          cache: "no-store",
        });
        if (!active) return;

        if (response.ok) {
          setAuthState("signed-in");
          await loadSessions();
          return;
        }
        setAuthState("signed-out");
      } catch {
        if (active) setAuthState("signed-out");
      }
    }

    void checkSession();
    return () => {
      active = false;
    };
  }, [loadSessions]);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setSigningIn(true);
    setError("");

    try {
      const response = await fetch("/api/dashboard/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey.trim() }),
      });
      if (!response.ok) {
        setError("Invalid API key");
        return;
      }

      setApiKey("");
      setAuthState("signed-in");
      await loadSessions();
    } catch {
      setError("Could not sign in. Please try again.");
    } finally {
      setSigningIn(false);
    }
  }

  if (authState === "checking") {
    return <DashboardSpinner />;
  }

  if (authState === "signed-out") {
    return (
      <div className="max-w-sm mx-auto mt-16 md:mt-24">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full glass-panel mb-6">
            <Receipt className="w-8 h-8 text-ink" />
          </div>
          <Image
            src="/logo-light.png"
            alt="OpenCheckout"
            width={873}
            height={286}
            priority
            className="h-16 w-auto mx-auto mb-3"
          />
          <p className="text-lg font-[320] text-ink-soft">Merchant dashboard</p>
        </div>

        <div className="glass-card p-6">
          <form onSubmit={handleLogin}>
            <label
              htmlFor="api-key-input"
              className="block font-mono text-xs uppercase tracking-[0.6px] text-ink-soft mb-3"
            >
              Sign in with API Key
            </label>
            <input
              id="api-key-input"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="sk_…"
              autoComplete="current-password"
              autoFocus
              required
              className="block w-full rounded-lg border border-hairline bg-canvas px-4 py-3 text-base font-[320] focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {error && (
              <p className="mt-3 text-sm text-accent-magenta font-[400]" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={signingIn || !apiKey.trim()}
              className="btn-primary w-full justify-center mt-4 py-3 disabled:opacity-40"
            >
              <LogIn className="w-4 h-4" />
              {signingIn ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) return <DashboardSpinner />;

  return (
    <div>
      <h1 className="text-[26px] font-[600] tracking-[-0.26px] text-ink mb-8">
        Transactions
      </h1>

      {error && (
        <p className="mb-4 text-sm text-accent-magenta" role="alert">
          {error}
        </p>
      )}

      <div className="card-hairline overflow-hidden">
        <div className="table-scroll">
          <table className="w-full text-base">
            <thead>
              <tr className="border-b border-hairline text-left">
                {['Session', 'Amount', 'Status', 'Date', 'Customer'].map((label) => (
                  <th
                    key={label}
                    className="px-5 py-4 font-mono text-xs uppercase tracking-[0.6px] text-ink-soft font-[400]"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-ink-soft font-[320]">
                    No transactions yet.
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr
                    key={session.id}
                    className="border-b border-hairline-soft hover:bg-surface-soft transition-colors"
                  >
                    <td className="px-5 py-4 font-mono text-sm text-ink">{session.id}</td>
                    <td className="px-5 py-4 font-[500] text-ink">
                      {formatAmount(session.amount_total ?? 0, session.currency)}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-[400] ${statusClass(session.status)}`}>
                        {session.status.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-ink-soft font-[320] text-sm">
                      {new Date(session.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-sm text-ink-soft font-mono truncate max-w-[200px]">
                      {session.customer_wallet ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DashboardSpinner() {
  return (
    <div className="flex justify-center py-16" aria-label="Loading dashboard">
      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function statusClass(status: string) {
  if (status === "completed") return "bg-block-mint text-ink";
  if (status === "open") return "bg-block-cream text-ink";
  if (status === "processing" || status === "preparing") {
    return "bg-block-lime text-ink";
  }
  if (status === "awaiting_approval") return "bg-block-lilac text-ink";
  return "bg-surface-soft text-ink-soft";
}
