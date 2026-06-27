"use client";

import { useEffect, useState } from "react";

export function SuccessRedirect({ successUrl }: { successUrl: string }) {
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          clearInterval(timer);
          window.location.assign(successUrl);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [successUrl]);

  return (
    <div className="glass-panel rounded-2xl p-4">
      <p className="text-sm text-ink-soft font-[320]">
        Redirecting to store in {countdown}s
      </p>
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-hairline">
        <div
          className="h-1 rounded-full bg-primary transition-all duration-1000"
          style={{ width: `${((3 - countdown) / 3) * 100}%` }}
        />
      </div>
    </div>
  );
}
