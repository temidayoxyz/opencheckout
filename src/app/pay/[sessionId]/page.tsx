import { notFound } from "next/navigation";
import { getCheckoutSessionWithMerchant } from "@/lib/checkout/sessions";
import { CheckoutPage } from "@/components/checkout/checkout-page";

interface PayPageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function PayPage({ params }: PayPageProps) {
  const { sessionId } = await params;

  const result = await getCheckoutSessionWithMerchant(sessionId);
  if (!result) {
    notFound();
  }

  const { session, merchant } = result;

  return (
    <CheckoutPage
      session={{
        id: session.id,
        status: session.status,
        amountTotal: session.amountTotal ?? 0,
        currency: session.currency,
        lineItems: session.lineItems ?? [],
        mode: session.mode,
        hasPendingGrant: Boolean(
          session.continueAccessToken && session.customerWallet
        ),
        pendingApprovalUrl: session.grantInteractUrl ?? undefined,
      }}
      merchantName={merchant.name}
    />
  );
}
