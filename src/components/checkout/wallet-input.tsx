"use client";

import { useState, useCallback } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { getCurrencyScale } from "@/lib/checkout/currency";

interface WalletInputProps {
  sessionId: string;
  amountTotal: number;
  currency: string;
  onSubmit: (walletAddress: string) => void;
  disabled?: boolean;
}

function formatAmount(amount: number, currency: string): string {
  const scale = getCurrencyScale(currency);
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: scale,
  });
  return formatter.format(amount / Math.pow(10, scale));
}

export function WalletInput({
  sessionId,
  amountTotal,
  currency,
  onSubmit,
  disabled,
}: WalletInputProps) {
  const [walletAddress, setWalletAddress] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");

      const trimmed = walletAddress.trim();
      if (!trimmed) {
        setError("Please enter a wallet address");
        return;
      }

      if (!trimmed.startsWith("https://")) {
        setError("Wallet address must start with https://");
        return;
      }

      try {
        new URL(trimmed);
      } catch {
        setError("Invalid URL format");
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(`/pay/${sessionId}/wallet`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet_address: trimmed }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error?.message ?? "Could not verify wallet address");
          setLoading(false);
          return;
        }

        const { interactUrl } = await res.json();
        onSubmit(trimmed);
        window.location.href = interactUrl;
      } catch {
        setError("Something went wrong. Please try again.");
        setLoading(false);
      }
    },
    [walletAddress, sessionId, onSubmit]
  );

  return (
    <form onSubmit={handleSubmit} className="mt-8">
      {/* Eyebrow */}
      <p className="font-mono text-xs uppercase tracking-[0.6px] text-ink-soft mb-3">
        Pay with Wallet Address
      </p>

      <input
        id="wallet-address"
        type="url"
        value={walletAddress}
        onChange={(e) => {
          setWalletAddress(e.target.value);
          setError("");
        }}
        placeholder="Enter your wallet address URL"
        disabled={disabled || loading}
        className="block w-full rounded-2xl border border-white/70 bg-white/65 px-4 py-3 text-lg font-[320] text-ink placeholder:text-ink-soft shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
        autoComplete="url"
        autoFocus
      />

      {error && (
        <p className="mt-3 text-sm text-accent-magenta font-[400]" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={disabled || loading || !walletAddress.trim()}
        className="btn-primary w-full justify-center mt-5 text-lg py-3.5 disabled:opacity-30"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Verifying…
          </>
        ) : (
          <>
            Pay {formatAmount(amountTotal, currency)}
            <ArrowRight className="w-5 h-5" />
          </>
        )}
      </button>
    </form>
  );
}
