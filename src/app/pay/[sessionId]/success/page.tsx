"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { TrustFooter } from "@/components/checkout/trust-footer";

function isValidRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export default function SuccessPage() {
  const params = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const rawUrl = searchParams.get("success_url") ?? "";
  const successUrl = isValidRedirectUrl(rawUrl) ? rawUrl : "";
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (!successUrl) return;
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          window.location.href = successUrl;
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [successUrl]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas p-4">
      <div className="max-w-md w-full">
        <div className="color-block color-block-mint text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-canvas mb-8">
            <CheckCircle2 className="w-10 h-10 text-ink" />
          </div>

          <h1 className="text-[32px] font-[600] tracking-[-0.4px] leading-tight text-ink mb-4">
            Payment Complete
          </h1>
          <p className="text-lg font-[320] text-ink-soft mb-8">
            Your payment has been processed successfully.
          </p>

          <div className="bg-canvas rounded-lg p-4">
            <p className="text-sm text-ink-soft font-[320]">
              Redirecting to store in {countdown}s
            </p>
            <div className="w-full bg-hairline rounded-full h-1 mt-3 overflow-hidden">
              <div
                className="bg-primary h-1 rounded-full transition-all duration-1000"
                style={{ width: `${((3 - countdown) / 3) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <TrustFooter />
      </div>
    </div>
  );
}
