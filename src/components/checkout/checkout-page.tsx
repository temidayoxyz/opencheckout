"use client";

import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { OrderSummary } from "./order-summary";
import { WalletInput } from "./wallet-input";
import { TrustFooter } from "./trust-footer";

interface SessionData {
  id: string;
  status: string;
  amountTotal: number;
  currency: string;
  lineItems: Array<{
    priceData: {
      currency: string;
      productData: { name: string; description?: string };
      unitAmount: number;
    };
    quantity: number;
  }>;
  mode: string;
  merchantId: string;
  continueAccessToken?: string | null;
  customerWallet?: string | null;
  incomingPaymentUrl?: string | null;
}

interface CheckoutPageProps {
  session: SessionData;
  merchantName: string;
}

export function CheckoutPage({ session, merchantName }: CheckoutPageProps) {
  const [step, setStep] = useState<"review" | "processing" | "error">("review");
  const [error, setError] = useState("");
  const [recovering, setRecovering] = useState(false);
  const [recoveryMsg, setRecoveryMsg] = useState("");

  const isExpired = session.status !== "open";
  const hasPendingGrant = !!(
    session.continueAccessToken && session.customerWallet
  );

  async function attemptRecovery() {
    setRecovering(true);
    setRecoveryMsg("");
    try {
      const res = await fetch(`/api/checkout/sessions/${session.id}/recover`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.recovered) {
        setRecoveryMsg(data.message || "Payment status checked");
        if (data.action === "expired") window.location.reload();
      } else {
        setStep("review");
        setRecoveryMsg("");
      }
    } catch {
      setRecoveryMsg("Could not check payment status");
    }
    setRecovering(false);
  }

  if (isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas p-4">
        <div className="max-w-md w-full">
          <div className="color-block color-block-cream text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-canvas mb-6">
              <AlertCircle className="w-8 h-8 text-ink" />
            </div>
            <h1 className="text-[26px] font-[600] tracking-[-0.26px] text-ink mb-3">
              Session {session.status}
            </h1>
            <p className="text-lg font-[320] text-ink-soft">
              This checkout session is no longer active.
            </p>
          </div>
          <TrustFooter />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-[26px] font-[600] tracking-[-0.26px] text-ink leading-tight">
            Complete Your Payment
          </h1>
        </div>

        {/* Order Summary — color block */}
        <OrderSummary
          lineItems={session.lineItems}
          amountTotal={session.amountTotal}
          currency={session.currency}
          merchantName={merchantName}
        />

        {/* Wallet Input */}
        <WalletInput
          sessionId={session.id}
          amountTotal={session.amountTotal}
          currency={session.currency}
          onSubmit={() => setStep("processing")}
          disabled={step === "processing"}
        />

        {/* Pending grant recovery — simple button below Pay */}
        {hasPendingGrant && (
          <div className="mt-4">
            <button
              onClick={attemptRecovery}
              disabled={recovering}
              className="btn-secondary w-full justify-center text-base py-2.5 disabled:opacity-30"
            >
              {recovering ? "Checking…" : "Check Payment Status"}
            </button>
            {recoveryMsg && (
              <p className="mt-2 text-sm text-ink-soft text-center">{recoveryMsg}</p>
            )}
          </div>
        )}

        {step === "processing" && (
          <div className="mt-4 flex items-center gap-3 text-base text-ink-soft font-[320] bg-surface-soft rounded-lg p-4">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            Redirecting you to your wallet provider to approve payment…
          </div>
        )}

        {error && (
          <div className="mt-4 text-sm text-accent-magenta font-[400] bg-block-pink rounded-lg p-3">
            {error}
          </div>
        )}

        <TrustFooter />
      </div>
    </div>
  );
}
