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
  hasPendingGrant: boolean;
  pendingApprovalUrl?: string;
}

interface CheckoutPageProps {
  session: SessionData;
  merchantName: string;
}

type CheckoutStep =
  | "review"
  | "preparing"
  | "pending"
  | "processing"
  | "error";

export function CheckoutPage({ session, merchantName }: CheckoutPageProps) {
  const [step, setStep] = useState<CheckoutStep>(() => {
    if (session.status === "preparing") return "preparing";
    if (
      session.status === "awaiting_approval" ||
      session.hasPendingGrant
    ) {
      return "pending";
    }
    if (session.status === "processing") return "processing";
    return "review";
  });
  const [recovering, setRecovering] = useState(false);
  const [recoveryMsg, setRecoveryMsg] = useState("");

  const isInactive = ["completed", "expired", "canceled"].includes(
    session.status
  );

  async function attemptRecovery() {
    setRecovering(true);
    setRecoveryMsg("");

    try {
      const res = await fetch(`/api/checkout/sessions/${session.id}/recover`, {
        method: "POST",
      });
      const data = await res.json();
      setRecoveryMsg(data.message || "Payment status checked");

      if (data.action === "expired") window.location.reload();
      if (data.action === "completed") {
        window.location.assign(`/pay/${session.id}/success`);
      }
      if (data.action === "resume_approval" && data.interact_url) {
        window.location.assign(data.interact_url);
      }
    } catch {
      setRecoveryMsg("Could not check payment status");
    } finally {
      setRecovering(false);
    }
  }

  if (isInactive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas liquid-bg p-4">
        <div className="max-w-md w-full">
          <div className="glass-card text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/70 border border-white/70 mb-6">
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
    <div className="min-h-screen flex items-center justify-center bg-canvas liquid-bg p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-[26px] font-[600] tracking-[-0.26px] text-ink leading-tight">
            Complete Your Payment
          </h1>
        </div>

        <OrderSummary
          lineItems={session.lineItems}
          amountTotal={session.amountTotal}
          currency={session.currency}
          merchantName={merchantName}
        />

        {step === "review" && (
          <WalletInput
            sessionId={session.id}
            amountTotal={session.amountTotal}
            currency={session.currency}
            onSubmit={() => setStep("processing")}
          />
        )}

        {(step === "pending" || step === "processing") && (
          <div className="mt-6 glass-panel rounded-2xl p-5">
            <p className="text-base text-ink-soft font-[320]">
              {step === "pending"
                ? "Your payment is ready for approval at your wallet provider."
                : "Your payment is being confirmed. Do not submit another payment."}
            </p>
            {step === "pending" && session.pendingApprovalUrl && (
              <a
                href={session.pendingApprovalUrl}
                className="btn-primary mt-4 w-full justify-center"
              >
                Continue approval
              </a>
            )}
            <button
              onClick={attemptRecovery}
              disabled={recovering}
              className="btn-secondary mt-3 w-full justify-center text-base py-2.5 disabled:opacity-30"
            >
              {recovering ? "Checking…" : "Check Payment Status"}
            </button>
            {recoveryMsg && (
              <p className="mt-3 text-sm text-ink-soft text-center">
                {recoveryMsg}
              </p>
            )}
          </div>
        )}

        {step === "preparing" && (
          <div className="mt-4 flex items-center gap-3 text-base text-ink-soft font-[320] bg-surface-soft rounded-lg p-4">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            Preparing your secure payment…
          </div>
        )}

        <TrustFooter />
      </div>
    </div>
  );
}
