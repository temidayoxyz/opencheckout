import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, generateApiKey } from "@/lib/merchant/auth";
import { getDb, schema } from "@/lib/db";
import { generateApiKeyId } from "@/lib/crypto/ids";
import { eq, and, isNull } from "drizzle-orm";

/**
 * GET /api/dashboard/keys
 * List API keys for the authenticated merchant.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const merchant = await authenticateApiKey(authHeader);
  if (!merchant) {
    return NextResponse.json(
      { error: { message: "Invalid API key" } },
      { status: 401 }
    );
  }

  const keys = await getDb()
    .select({
      id: schema.apiKeys.id,
      name: schema.apiKeys.name,
      createdAt: schema.apiKeys.createdAt,
      revokedAt: schema.apiKeys.revokedAt,
    })
    .from(schema.apiKeys)
    .where(eq(schema.apiKeys.merchantId, merchant.id))
    .orderBy(schema.apiKeys.createdAt);

  return NextResponse.json({ keys });
}

/**
 * POST /api/dashboard/keys
 * Create a new API key for the authenticated merchant.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const merchant = await authenticateApiKey(authHeader);
  if (!merchant) {
    return NextResponse.json(
      { error: { message: "Invalid API key" } },
      { status: 401 }
    );
  }

  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  const { plaintext, hash } = generateApiKey();
  const id = generateApiKeyId();

  await getDb().insert(schema.apiKeys).values({
    id,
    merchantId: merchant.id,
    keyHash: hash,
    name: body.name ?? "Unnamed",
  });

  return NextResponse.json(
    { id, name: body.name ?? "Unnamed", plaintext },
    { status: 201 }
  );
}

/**
 * DELETE /api/dashboard/keys?id=xxx
 * Revoke an API key.
 */
export async function DELETE(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const merchant = await authenticateApiKey(authHeader);
  if (!merchant) {
    return NextResponse.json(
      { error: { message: "Invalid API key" } },
      { status: 401 }
    );
  }

  const keyId = new URL(request.url).searchParams.get("id");
  if (!keyId) {
    return NextResponse.json(
      { error: { message: "Missing key id" } },
      { status: 400 }
    );
  }

  // Verify the key belongs to this merchant
  const key = await getDb()
    .select()
    .from(schema.apiKeys)
    .where(
      and(
        eq(schema.apiKeys.id, keyId),
        eq(schema.apiKeys.merchantId, merchant.id),
        isNull(schema.apiKeys.revokedAt)
      )
    )
    .limit(1);

  if (key.length === 0) {
    return NextResponse.json(
      { error: { message: "Key not found" } },
      { status: 404 }
    );
  }

  await getDb()
    .update(schema.apiKeys)
    .set({ revokedAt: new Date().toISOString() })
    .where(eq(schema.apiKeys.id, keyId));

  return NextResponse.json({ success: true });
}
