"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { TrustFooter } from "./trust-footer";

interface PaymentStatusProps {
  status: "completed" | "expired" | "canceled" | "error";
  successUrl?: string;
  cancelUrl?: string;
  errorMessage?: string;
}

export function PaymentStatus({
  status,
  successUrl,
  cancelUrl,
  errorMessage,
}: PaymentStatusProps) {
  const [countdown, setCountdown] = useState(5);

  function redirectIfValid(url: string) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "https:" || parsed.protocol === "http:") {
        window.location.href = url;
      }
    } catch {
      // Invalid URL — do not redirect
    }
  }

  useEffect(() => {
    if (status === "completed" && successUrl) {
      setTimeout(() => redirectIfValid(successUrl), 3000);
      return;
    }

    if ((status === "expired" || status === "canceled") && cancelUrl) {
      const interval = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(interval);
            redirectIfValid(cancelUrl);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status, successUrl, cancelUrl]);

  const config = {
    completed: {
      icon: CheckCircle2,
      title: "Payment Complete",
      message: "Redirecting you back to the store…",
      block: "color-block-mint",
    },
    expired: {
      icon: Clock,
      title: "Session Expired",
      message: `This checkout session has expired. Returning in ${countdown}…`,
      block: "color-block-cream",
    },
    canceled: {
      icon: XCircle,
      title: "Payment Canceled",
      message: `Returning to store in ${countdown}…`,
      block: "color-block-cream",
    },
    error: {
      icon: AlertTriangle,
      title: "Something Went Wrong",
      message: errorMessage ?? "An error occurred. Please try again.",
      block: "color-block-pink",
    },
  };

  const c = config[status];
  const Icon = c.icon;

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas p-4">
      <div className="max-w-md w-full">
        <div className={`color-block ${c.block} text-center`}>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-canvas mb-6">
            <Icon className="w-8 h-8 text-ink" />
          </div>
          <h1 className="text-[26px] font-[600] tracking-[-0.26px] text-ink mb-3">
            {c.title}
          </h1>
          <p className="text-lg font-[320] text-ink-soft">{c.message}</p>

          {status === "completed" && (
            <div className="mt-6 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-ink-soft" />
            </div>
          )}
        </div>
        <TrustFooter />
      </div>
    </div>
  );
}
