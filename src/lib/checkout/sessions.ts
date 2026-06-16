import { eq, and, lt } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { CreateSessionInput } from "./validation";
import { generateSessionId } from "@/lib/crypto/ids";
import { SESSION_STATUS, transition } from "./state-machine";

/**
 * Create a new checkout session.
 * This initializes the session in "open" status.
 * The incoming payment is NOT created here — that happens
 * when the merchant proceeds with the payment flow.
 */
export async function createCheckoutSession(
  merchantId: string,
  input: CreateSessionInput,
  baseUrl: string
) {
  const id = generateSessionId();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + (input.expires_in_seconds ?? 86400) * 1000
  );

  // Calculate total amount
  const amountTotal = input.line_items.reduce(
    (sum, item) => sum + item.price_data.unit_amount * item.quantity,
    0
  );
  const currency = input.line_items[0].price_data.currency;

  // Map Stripe API format (snake_case) to DB format (camelCase)
  const lineItems = input.line_items.map((item) => ({
    priceData: {
      currency: item.price_data.currency,
      productData: {
        name: item.price_data.product_data.name,
        description: item.price_data.product_data.description,
      },
      unitAmount: item.price_data.unit_amount,
    },
    quantity: item.quantity,
  }));

  const url = `${baseUrl}/pay/${id}`;

  const session = {
    id,
    merchantId,
    mode: input.mode,
    status: "open" as const,
    amountTotal,
    currency,
    lineItems,
    metadata: input.metadata ?? null,
    successUrl: input.success_url.replace("{CHECKOUT_SESSION_ID}", id),
    cancelUrl: input.cancel_url.replace("{CHECKOUT_SESSION_ID}", id),
    url,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  await getDb().insert(schema.checkoutSessions).values(session);

  return session;
}

/**
 * Get a checkout session by ID.
 */
export async function getCheckoutSession(id: string) {
  const result = await getDb()
    .select()
    .from(schema.checkoutSessions)
    .where(eq(schema.checkoutSessions.id, id))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get a checkout session with merchant info.
 */
export async function getCheckoutSessionWithMerchant(id: string) {
  const result = await getDb()
    .select({
      session: schema.checkoutSessions,
      merchant: schema.merchants,
    })
    .from(schema.checkoutSessions)
    .innerJoin(
      schema.merchants,
      eq(schema.checkoutSessions.merchantId, schema.merchants.id)
    )
    .where(eq(schema.checkoutSessions.id, id))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Transition a session to a new status.
 * Validates the state machine transition.
 */
export async function updateSessionStatus(
  id: string,
  newStatus: (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS]
) {
  const session = await getCheckoutSession(id);
  if (!session) throw new Error("Session not found");

  transition(session.status as typeof SESSION_STATUS.OPEN, newStatus);

  const updates: Record<string, string> = { status: newStatus };

  if (newStatus === SESSION_STATUS.COMPLETED) {
    updates.completedAt = new Date().toISOString();
  }

  await getDb()
    .update(schema.checkoutSessions)
    .set(updates)
    .where(eq(schema.checkoutSessions.id, id));

  return getCheckoutSession(id);
}

/**
 * Save Open Payments references to a session.
 */
export async function saveSessionOpReferences(
  id: string,
  refs: {
    incomingPaymentUrl?: string;
    incomingPaymentId?: string;
    quoteUrl?: string;
    quoteId?: string;
    outgoingPaymentUrl?: string;
    continueAccessToken?: string;
    continueUri?: string;
    interactRef?: string;
    customerWallet?: string;
  }
) {
  const updates: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(refs)) {
    if (value !== undefined) {
      updates[key] = value;
    }
  }

  await getDb()
    .update(schema.checkoutSessions)
    .set(updates)
    .where(eq(schema.checkoutSessions.id, id));
}

/**
 * List sessions for a merchant (paginated).
 */
export async function listCheckoutSessions(
  merchantId: string,
  options: { limit?: number; cursor?: string } = {}
) {
  const { limit = 10, cursor } = options;

  const conditions = [eq(schema.checkoutSessions.merchantId, merchantId)];
  if (cursor) {
    conditions.push(lt(schema.checkoutSessions.createdAt, cursor));
  }

  const sessions = await getDb()
    .select()
    .from(schema.checkoutSessions)
    .where(and(...conditions))
    .orderBy(schema.checkoutSessions.createdAt)
    .limit(limit);

  return sessions;
}

/**
 * Expire all sessions that have passed their expiration time.
 * This is called by a cron job or background worker.
 */
export async function expireStaleSessions(): Promise<string[]> {
  const now = new Date().toISOString();

  const staleSessions = await getDb()
    .select()
    .from(schema.checkoutSessions)
    .where(
      and(
        eq(schema.checkoutSessions.status, SESSION_STATUS.OPEN),
        lt(schema.checkoutSessions.expiresAt, now)
      )
    );

  const expiredIds: string[] = [];

  for (const session of staleSessions) {
    await updateSessionStatus(session.id, SESSION_STATUS.EXPIRED);
    expiredIds.push(session.id);
  }

  return expiredIds;
}
