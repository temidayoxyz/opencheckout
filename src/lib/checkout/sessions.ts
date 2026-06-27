import { eq, and, lt, gt, desc, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { CreateSessionInput } from "./validation";
import { generateSessionId } from "@/lib/crypto/ids";
import { SESSION_STATUS, transition } from "./state-machine";
import {
  decryptStoredSecret,
  encryptStoredSecret,
} from "@/lib/crypto/keys";

type CheckoutSession = typeof schema.checkoutSessions.$inferSelect;

export function toPublicCheckoutSession(
  session: Partial<CheckoutSession> & Record<string, unknown>
) {
  const lineItems = session.lineItems?.map((item) => ({
    price_data: {
      currency: item.priceData.currency,
      product_data: {
        name: item.priceData.productData.name,
        ...(item.priceData.productData.description
          ? { description: item.priceData.productData.description }
          : {}),
      },
      unit_amount: item.priceData.unitAmount,
    },
    quantity: item.quantity,
  }));

  return {
    id: session.id,
    object: "checkout.session",
    mode: session.mode,
    status: session.status,
    url: session.url,
    amount_total: session.amountTotal ?? null,
    currency: session.currency,
    line_items: lineItems ?? [],
    metadata: session.metadata ?? {},
    success_url: session.successUrl,
    cancel_url: session.cancelUrl,
    customer_wallet: session.customerWallet ?? null,
    incoming_payment: session.incomingPaymentUrl ?? null,
    outgoing_payment: session.outgoingPaymentUrl ?? null,
    created_at: session.createdAt,
    expires_at: session.expiresAt,
    completed_at: session.completedAt ?? null,
  };
}

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

  // Map public REST API format (snake_case) to DB format (camelCase)
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

  let session = result[0];
  if (!session) return null;

  session = await recoverStalePreparation(session);
  return hydrateSensitiveSession(await expireSessionIfNeeded(session));
}

async function recoverStalePreparation(session: CheckoutSession) {
  const startedAt = session.preparationStartedAt
    ? new Date(session.preparationStartedAt).getTime()
    : 0;
  const staleBefore = Date.now() - 5 * 60 * 1000;
  if (
    session.status !== SESSION_STATUS.PREPARING ||
    (startedAt > 0 && startedAt > staleBefore)
  ) {
    return session;
  }

  const recovered = await getDb()
    .update(schema.checkoutSessions)
    .set({ status: SESSION_STATUS.OPEN, preparationStartedAt: null })
    .where(
      and(
        eq(schema.checkoutSessions.id, session.id),
        eq(schema.checkoutSessions.status, SESSION_STATUS.PREPARING)
      )
    )
    .returning();

  return recovered[0] ?? session;
}

function hydrateSensitiveSession(session: CheckoutSession): CheckoutSession {
  return {
    ...session,
    continueAccessToken: session.continueAccessToken
      ? decryptStoredSecret(session.continueAccessToken)
      : null,
    continueUri: session.continueUri
      ? decryptStoredSecret(session.continueUri)
      : null,
  };
}

/**
 * Get a checkout session with merchant info.
 */
export async function getCheckoutSessionWithMerchant(id: string) {
  const session = await getCheckoutSession(id);
  if (!session) return null;

  const merchants = await getDb()
    .select()
    .from(schema.merchants)
    .where(eq(schema.merchants.id, session.merchantId))
    .limit(1);

  const merchant = merchants[0];
  return merchant ? { session, merchant } : null;
}

async function expireSessionIfNeeded(session: CheckoutSession) {
  const expirableStatuses: Set<CheckoutSession["status"]> = new Set([
    SESSION_STATUS.OPEN,
    SESSION_STATUS.PREPARING,
    SESSION_STATUS.AWAITING_APPROVAL,
  ]);

  if (
    !expirableStatuses.has(session.status) ||
    new Date(session.expiresAt).getTime() > Date.now()
  ) {
    return session;
  }

  const expired = await getDb()
    .update(schema.checkoutSessions)
    .set({ status: SESSION_STATUS.EXPIRED })
    .where(
      and(
        eq(schema.checkoutSessions.id, session.id),
        inArray(schema.checkoutSessions.status, [...expirableStatuses]),
        lt(schema.checkoutSessions.expiresAt, new Date().toISOString())
      )
    )
    .returning();

  return expired[0] ?? session;
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

  transition(
    session.status as (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS],
    newStatus
  );

  const updates: Record<string, string | null> = { status: newStatus };

  if (newStatus !== SESSION_STATUS.PREPARING) {
    updates.preparationStartedAt = null;
  }

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
    continueAccessToken?: string | null;
    continueUri?: string | null;
    interactRef?: string;
    grantClientNonce?: string | null;
    grantServerNonce?: string | null;
    grantAuthServerUrl?: string | null;
    grantInteractUrl?: string | null;
    customerWallet?: string;
  }
) {
  const updates: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(refs)) {
    if (value !== undefined) {
      updates[key] =
        value !== null &&
        (key === "continueAccessToken" || key === "continueUri")
          ? encryptStoredSecret(value)
          : value;
    }
  }

  await getDb()
    .update(schema.checkoutSessions)
    .set(updates)
    .where(eq(schema.checkoutSessions.id, id));
}

/** Atomically claim a session before creating any Open Payments resources. */
export async function claimSessionForPreparation(id: string) {
  const claimed = await getDb()
    .update(schema.checkoutSessions)
    .set({
      status: SESSION_STATUS.PREPARING,
      preparationStartedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(schema.checkoutSessions.id, id),
        eq(schema.checkoutSessions.status, SESSION_STATUS.OPEN),
        gt(schema.checkoutSessions.expiresAt, new Date().toISOString())
      )
    )
    .returning();

  return claimed[0] ?? null;
}

/** Release a preparation claim after a safe, retryable failure. */
export async function releaseSessionPreparation(id: string) {
  const released = await getDb()
    .update(schema.checkoutSessions)
    .set({ status: SESSION_STATUS.OPEN, preparationStartedAt: null })
    .where(
      and(
        eq(schema.checkoutSessions.id, id),
        eq(schema.checkoutSessions.status, SESSION_STATUS.PREPARING)
      )
    )
    .returning();

  return released[0] ?? null;
}

/**
 * Atomically claim an open session for final payment creation.
 * Only one callback request can move a session from open -> processing.
 */
export async function claimSessionForPayment(id: string) {
  const now = new Date().toISOString();

  const claimed = await getDb()
    .update(schema.checkoutSessions)
    .set({ status: SESSION_STATUS.PROCESSING })
    .where(
      and(
        eq(schema.checkoutSessions.id, id),
        inArray(schema.checkoutSessions.status, [
          SESSION_STATUS.OPEN,
          SESSION_STATUS.AWAITING_APPROVAL,
        ]),
        gt(schema.checkoutSessions.expiresAt, now)
      )
    )
    .returning();

  return claimed[0] ?? null;
}

/**
 * List sessions for a merchant (paginated).
 */
export async function listCheckoutSessions(
  merchantId: string,
  options: { limit?: number; cursor?: string } = {}
) {
  await expireStaleSessions();
  const { limit = 10, cursor } = options;

  const conditions = [eq(schema.checkoutSessions.merchantId, merchantId)];
  if (cursor) {
    conditions.push(lt(schema.checkoutSessions.createdAt, cursor));
  }

  const sessions = await getDb()
    .select()
    .from(schema.checkoutSessions)
    .where(and(...conditions))
    .orderBy(desc(schema.checkoutSessions.createdAt))
    .limit(limit);

  return sessions;
}

/**
 * Expire all sessions that have passed their expiration time.
 * This is called by a cron job or background worker.
 */
export async function expireStaleSessions(): Promise<string[]> {
  const now = new Date().toISOString();
  const expired = await getDb()
    .update(schema.checkoutSessions)
    .set({ status: SESSION_STATUS.EXPIRED })
    .where(
      and(
        inArray(schema.checkoutSessions.status, [
          SESSION_STATUS.OPEN,
          SESSION_STATUS.PREPARING,
          SESSION_STATUS.AWAITING_APPROVAL,
        ]),
        lt(schema.checkoutSessions.expiresAt, now)
      )
    )
    .returning({ id: schema.checkoutSessions.id });

  return expired.map((session) => session.id);
}
