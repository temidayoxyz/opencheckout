import { CheckCircle2 } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { TrustFooter } from "@/components/checkout/trust-footer";
import { getCheckoutSession } from "@/lib/checkout/sessions";
import { SESSION_STATUS } from "@/lib/checkout/state-machine";
import { SuccessRedirect } from "./success-redirect";

export default async function SuccessPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await getCheckoutSession(sessionId);

  if (!session) notFound();

  if (session.status !== SESSION_STATUS.COMPLETED) {
    redirect(`/pay/${sessionId}`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas p-4 liquid-bg">
      <div className="max-w-md w-full">
        <div className="glass-card text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/70 border border-white/70 shadow-[0_18px_60px_rgba(17,24,39,0.12)] mb-8">
            <CheckCircle2 className="w-10 h-10 text-ink" />
          </div>

          <h1 className="text-[32px] font-[600] tracking-[-0.4px] leading-tight text-ink mb-4">
            Payment Complete
          </h1>
          <p className="text-lg font-[320] text-ink-soft mb-8">
            Your payment has been processed successfully.
          </p>

          <SuccessRedirect successUrl={session.successUrl} />
        </div>

        <TrustFooter />
      </div>
    </div>
  );
}
