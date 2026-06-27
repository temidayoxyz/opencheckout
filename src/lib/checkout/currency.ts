const CURRENCY_SCALES: Record<string, number> = {
  bif: 0,
  clp: 0,
  djf: 0,
  gnf: 0,
  jpy: 0,
  kmf: 0,
  krw: 0,
  mga: 0,
  pyg: 0,
  rwf: 0,
  ugx: 0,
  vnd: 0,
  vuv: 0,
  xaf: 0,
  xof: 0,
  xpf: 0,
  bhd: 3,
  jod: 3,
  kwd: 3,
  omr: 3,
  tnd: 3,
};

/**
 * Most ISO-4217 currencies use two minor-unit decimals.
 * This table captures the common zero- and three-decimal exceptions.
 */
export function getCurrencyScale(currency: string): number {
  return CURRENCY_SCALES[currency.toLowerCase()] ?? 2;
}

export function toOpenPaymentsAmount(value: number, currency: string) {
  return {
    value: value.toString(),
    assetCode: currency.toUpperCase(),
    assetScale: getCurrencyScale(currency),
  };
}
