"use client";

import { useEffect, useState } from "react";
import { LogIn, Receipt } from "lucide-react";

function getApiKey(): string | null {
  const cookies = document.cookie.split("; ");
  const authCookie = cookies.find((c) => c.startsWith("oc_api_key="));
  return authCookie ? authCookie.split("=")[1] : null;
}

interface Session {
  id: string;
  status: string;
  amountTotal: number;
  currency: string;
  mode: string;
  createdAt: string;
  completedAt: string | null;
  customerWallet: string | null;
}

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

export default function DashboardPage() {
  const [apiKey, setApiKey] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const key = getApiKey();
    if (key) setApiKey(key);
  }, []);

  useEffect(() => {
    if (!apiKey) {
      setLoading(false);
      return;
    }

    fetch("/api/checkout/sessions?limit=50", {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject("Unauthorized")))
      .then((data) => {
        setSessions(data.data || []);
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load transactions.");
        setLoading(false);
      });
  }, [apiKey]);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const key = (document.getElementById("api-key-input") as HTMLInputElement)
      .value;
    fetch("/api/checkout/sessions?limit=1", {
      headers: { Authorization: `Bearer ${key.trim()}` },
    }).then((r) => {
      if (r.ok) {
        document.cookie = `oc_api_key=${key.trim()}; path=/; SameSite=Lax`;
        setApiKey(key.trim());
        setError("");
      } else {
        setError("Invalid API key");
      }
    });
  }

  if (!apiKey) {
    return (
      <div className="max-w-sm mx-auto mt-24">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-block-mint mb-6">
            <Receipt className="w-8 h-8 text-ink" />
          </div>
          <img
            src="/logo-light.png"
            alt="OpenCheckout"
            className="h-16 w-auto mx-auto mb-3"
          />
          <p className="text-lg font-[320] text-ink-soft">Merchant dashboard</p>
        </div>

        <div className="card-hairline p-6">
          <form onSubmit={handleLogin}>
            <p className="font-mono text-xs uppercase tracking-[0.6px] text-ink-soft mb-3">
              Sign in with API Key
            </p>
            <input
              id="api-key-input"
              type="password"
              placeholder="sk_…"
              autoFocus
              className="block w-full rounded-lg border border-hairline bg-canvas px-4 py-3 text-base font-[320] focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {error && (
              <p className="mt-3 text-sm text-accent-magenta font-[400]">{error}</p>
            )}
            <button
              type="submit"
              className="btn-primary w-full justify-center mt-4 py-3"
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[26px] font-[600] tracking-[-0.26px] text-ink mb-8">
        Transactions
      </h1>

      <div className="card-hairline overflow-hidden">
        <table className="w-full text-base">
          <thead>
            <tr className="border-b border-hairline text-left">
              <th className="px-5 py-4 font-mono text-xs uppercase tracking-[0.6px] text-ink-soft font-[400]">
                Session
              </th>
              <th className="px-5 py-4 font-mono text-xs uppercase tracking-[0.6px] text-ink-soft font-[400]">
                Amount
              </th>
              <th className="px-5 py-4 font-mono text-xs uppercase tracking-[0.6px] text-ink-soft font-[400]">
                Status
              </th>
              <th className="px-5 py-4 font-mono text-xs uppercase tracking-[0.6px] text-ink-soft font-[400]">
                Date
              </th>
              <th className="px-5 py-4 font-mono text-xs uppercase tracking-[0.6px] text-ink-soft font-[400]">
                Customer
              </th>
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
              sessions.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-hairline-soft hover:bg-surface-soft transition-colors"
                >
                  <td className="px-5 py-4 font-mono text-sm text-ink">
                    {s.id}
                  </td>
                  <td className="px-5 py-4 font-[500] text-ink">
                    {formatAmount(s.amountTotal, s.currency)}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-[400] ${
                        s.status === "completed"
                          ? "bg-block-mint text-ink"
                          : s.status === "open"
                          ? "bg-block-cream text-ink"
                          : "bg-surface-soft text-ink-soft"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-ink-soft font-[320] text-sm">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4 text-sm text-ink-soft font-mono truncate max-w-[200px]">
                    {s.customerWallet ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
