import { z } from "zod";

/**
 * Zod schema for creating a checkout session.
 * Validates OpenCheckout Checkout Session creation requests.
 */
export const createSessionSchema = z.object({
  mode: z.literal("payment", {
    error: "Only one-time payment mode is currently supported",
  }),
  line_items: z
    .array(
      z.object({
        price_data: z.object({
          currency: z
            .string()
            .length(3)
            .regex(/^[a-zA-Z]{3}$/, "currency must contain three letters")
            .transform((c) => c.toLowerCase()),
          product_data: z.object({
            name: z.string().min(1).max(200),
            description: z.string().max(1000).optional(),
          }),
          unit_amount: z.number().int().positive().max(999_999_999_999),
        }),
        quantity: z.number().int().positive().max(1_000_000).default(1),
      })
    )
    .min(1)
    .max(100),
  success_url: z.string().max(2048).url().refine((url) => url.startsWith("https://"), {
    message: "success_url must use HTTPS",
  }),
  cancel_url: z.string().max(2048).url().refine((url) => url.startsWith("https://"), {
    message: "cancel_url must use HTTPS",
  }),
  metadata: z
    .record(z.string().min(1).max(40), z.string().max(500))
    .refine((metadata) => Object.keys(metadata).length <= 50, {
      message: "metadata supports at most 50 entries",
    })
    .optional(),
  expires_in_seconds: z.number().int().min(300).max(86400).default(86400), // 5min to 24h
})
.refine(
  (input) => {
    const firstCurrency = input.line_items[0]?.price_data.currency;
    return input.line_items.every(
      (item) => item.price_data.currency === firstCurrency
    );
  },
  {
    message: "All line items must use the same currency",
    path: ["line_items"],
  }
)
.refine(
  (input) => {
    const total = input.line_items.reduce(
      (sum, item) => sum + item.price_data.unit_amount * item.quantity,
      0
    );
    return Number.isSafeInteger(total) && total <= 999_999_999_999;
  },
  {
    message: "Checkout total exceeds the supported amount",
    path: ["line_items"],
  }
);

export type CreateSessionInput = z.infer<typeof createSessionSchema>;

/**
 * Schema for submitting a wallet address during checkout.
 */
export const walletSubmissionSchema = z.object({
  wallet_address: z
    .string()
    .max(2048)
    .url()
    .refine((url) => url.startsWith("https://"), {
      message: "Wallet address must use HTTPS",
    }),
});

export type WalletSubmissionInput = z.infer<typeof walletSubmissionSchema>;
