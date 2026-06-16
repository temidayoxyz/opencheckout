import { z } from "zod";

/**
 * Zod schema for creating a checkout session.
 * Mirrors Stripe's Checkout Session creation API.
 */
export const createSessionSchema = z.object({
  mode: z.enum(["payment", "subscription", "donation"]),
  line_items: z
    .array(
      z.object({
        price_data: z.object({
          currency: z
            .string()
            .length(3)
            .transform((c) => c.toLowerCase()),
          product_data: z.object({
            name: z.string().min(1).max(200),
            description: z.string().max(1000).optional(),
          }),
          unit_amount: z.number().int().positive(),
        }),
        quantity: z.number().int().positive().default(1),
      })
    )
    .min(1)
    .max(100),
  success_url: z.string().url(),
  cancel_url: z.string().url(),
  metadata: z.record(z.string(), z.string()).optional(),
  expires_in_seconds: z.number().int().min(300).max(86400).default(86400), // 5min to 24h
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;

/**
 * Schema for submitting a wallet address during checkout.
 */
export const walletSubmissionSchema = z.object({
  wallet_address: z
    .string()
    .url()
    .refine((url) => url.startsWith("https://"), {
      message: "Wallet address must use HTTPS",
    }),
});

export type WalletSubmissionInput = z.infer<typeof walletSubmissionSchema>;
