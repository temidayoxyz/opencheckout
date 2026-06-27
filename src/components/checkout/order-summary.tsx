import { getCurrencyScale } from "@/lib/checkout/currency";

interface LineItem {
  priceData: {
    currency: string;
    productData: { name: string; description?: string };
    unitAmount: number;
  };
  quantity: number;
}

interface OrderSummaryProps {
  lineItems: LineItem[];
  amountTotal: number;
  currency: string;
  merchantName: string;
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

export function OrderSummary({
  lineItems,
  amountTotal,
  currency,
  merchantName,
}: OrderSummaryProps) {
  return (
    <div className="glass-card">
      <p className="font-mono text-xs uppercase tracking-[0.6px] text-ink-soft mb-4">
        {merchantName}
      </p>

      <div className="space-y-4">
        {lineItems.map((item, i) => {
          const lineTotal = item.priceData.unitAmount * item.quantity;
          return (
            <div key={i} className="flex justify-between text-lg font-[320]">
              <div className="flex-1">
                <p className="text-ink">
                  {item.priceData.productData.name}
                  {item.quantity > 1 && (
                    <span className="text-ink-soft ml-1">×{item.quantity}</span>
                  )}
                </p>
                {item.priceData.productData.description && (
                  <p className="text-sm text-ink-soft mt-1 font-[320]">
                    {item.priceData.productData.description}
                  </p>
                )}
              </div>
              <p className="text-ink ml-4">{formatAmount(lineTotal, currency)}</p>
            </div>
          );
        })}
      </div>

      <div className="border-t border-hairline mt-6 pt-5 flex justify-between">
        <span className="text-lg font-[600] text-ink">Total</span>
        <span className="text-lg font-[600] text-ink">
          {formatAmount(amountTotal, currency)}
        </span>
      </div>
    </div>
  );
}
