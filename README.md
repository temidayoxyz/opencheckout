# OpenCheckout

OpenCheckout is checkout orchestration software built on the
[Open Payments](https://openpayments.dev) protocol. It gives merchants a hosted
payment page, a REST API, a dashboard, signed webhooks, and a deployment they
control.

Customers approve payments with an Open Payments-enabled wallet, bank, or
mobile-money account. OpenCheckout itself does not hold funds or add a
per-transaction fee; account providers may still apply their own fees or
exchange rates.

## What it does

1. Your backend creates a checkout session.
2. You redirect the customer to the session URL.
3. The customer enters their wallet address.
4. OpenCheckout creates the incoming payment and quote, then requests an
   interactive outgoing-payment grant.
5. The customer approves at their wallet provider.
6. OpenCheckout creates the outgoing payment, records completion, sends a
   signed webhook, and forwards the customer to your success URL.

OpenCheckout sends payment instructions; the customer's and merchant's account
providers execute and settle the payment. Regulatory obligations vary by
jurisdiction and business model, so production operators should obtain their
own legal guidance.

## Features

- One-time Checkout Sessions REST API
- Wallet-agnostic and cross-currency Open Payments flow
- Resumable interactive approval and interrupted-payment reconciliation
- Concurrency-safe payment preparation and callback handling
- Merchant dashboard for transactions, API keys, and webhook settings
- HMAC-SHA256 signed webhooks with immediate retries
- Idempotent session creation with 24-hour key cleanup
- Encrypted merchant keys, webhook secrets, and pending grant credentials
- SSRF-resistant public URL checks and fail-closed interaction hashes
- SQLite WAL storage with automatic schema bootstrap
- Docker Compose deployment with a non-root runtime and health checks

## Requirements

- Node.js 22+
- npm 10+
- An Open Payments wallet address with an Ed25519 developer key
- Docker and a TLS reverse proxy for production

For testing, create wallets at
[wallet.interledger-test.dev](https://wallet.interledger-test.dev).

## Local setup

```bash
git clone https://github.com/temidayoxyz/opencheckout
cd opencheckout
npm install
cp .env.example .env.local
```

Set a 64-character encryption key and the local URL:

```dotenv
DATABASE_URL=data/opencheckout.db
ENCRYPTION_KEY=<output of: openssl rand -hex 32>
BASE_URL=http://localhost:3000
CORS_ALLOWED_ORIGINS=
MAINTENANCE_SECRET=<output of: openssl rand -hex 32>
```

If your wallet downloads a raw `private.key`, convert it to PEM before setup:

```bash
{
  echo "-----BEGIN PRIVATE KEY-----"
  cat private.key
  echo "-----END PRIVATE KEY-----"
} > private.pem
```

Run the merchant setup wizard, then start the app:

```bash
npm run setup
npm run dev
```

Open `http://localhost:3000/dashboard` and sign in with the API key shown once
by the setup wizard.

## Create a checkout

All money values are integers in the currency's smallest unit.

```bash
curl -X POST http://localhost:3000/api/checkout/sessions \
  -H "Authorization: Bearer sk_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123" \
  -d '{
    "mode": "payment",
    "line_items": [{
      "price_data": {
        "currency": "usd",
        "product_data": {
          "name": "T-shirt",
          "description": "Organic cotton"
        },
        "unit_amount": 2000
      },
      "quantity": 1
    }],
    "success_url": "https://store.example/orders/123/success?session_id={CHECKOUT_SESSION_ID}",
    "cancel_url": "https://store.example/orders/123/cart",
    "metadata": { "order_id": "123" }
  }'
```

Response fields use snake_case:

```json
{
  "id": "cs_abc123",
  "object": "checkout.session",
  "mode": "payment",
  "status": "open",
  "url": "http://localhost:3000/pay/cs_abc123",
  "amount_total": 2000,
  "currency": "usd",
  "line_items": [],
  "metadata": { "order_id": "123" },
  "success_url": "https://store.example/orders/123/success?session_id=cs_abc123",
  "cancel_url": "https://store.example/orders/123/cart",
  "customer_wallet": null,
  "incoming_payment": null,
  "outgoing_payment": null,
  "created_at": "2026-06-27T00:00:00.000Z",
  "expires_at": "2026-06-28T00:00:00.000Z",
  "completed_at": null
}
```

Redirect the customer to `url`. Confirm fulfillment through the signed webhook
or by retrieving the session server-side; never trust the browser redirect
alone.

## API

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/checkout/sessions` | Create a session |
| `GET` | `/api/checkout/sessions` | List sessions |
| `GET` | `/api/checkout/sessions/:id` | Retrieve a session |
| `POST` | `/api/checkout/sessions/:id/expire` | Expire an open session |
| `POST` | `/api/checkout/sessions/:id/cancel` | Cancel an open session |
| `GET` | `/api/health` | Process and database readiness |

Checkout API requests use `Authorization: Bearer sk_...`. Browser CORS is
disabled by default because API keys belong on your backend. If browser access
is intentional, set `CORS_ALLOWED_ORIGINS` to a comma-separated allowlist.

## Production with Docker

Create `.env`:

```dotenv
ENCRYPTION_KEY=<output of: openssl rand -hex 32>
BASE_URL=https://pay.store.example
CORS_ALLOWED_ORIGINS=
```

Build the image, then run setup inside the same Docker volume used by the app:

```bash
docker compose build
docker compose --profile setup run --rm \
  -v "/absolute/path/private.pem:/run/secrets/merchant-private.pem:ro" \
  setup
```

When prompted for the private-key path, enter
`/run/secrets/merchant-private.pem`. Then start the service:

```bash
docker compose up -d opencheckout
```

OpenCheckout listens on port `3080`. Put it behind HTTPS with Caddy, Nginx, or
another reverse proxy. Do not expose port 3080 publicly.

Schedule maintenance every few minutes to expire abandoned sessions, clean old
idempotency records, and replay durable webhook failures:

```bash
*/5 * * * * cd /srv/opencheckout && docker compose exec -T opencheckout node scripts/maintenance.mjs
```

## Backups and upgrades

SQLite runs in WAL mode. Use SQLite's online backup API or stop the service
before copying the database; copying only the main file while writes are active
can produce an inconsistent backup.

```bash
docker compose stop opencheckout
docker run --rm \
  -v opencheckout_opencheckout_data:/data \
  -v "$PWD/backups:/backup" \
  alpine cp /data/opencheckout.db /backup/opencheckout-$(date +%Y%m%d).db
docker compose start opencheckout
```

Before upgrades: back up the database, read release notes, rebuild, and verify
`/api/health`.

## Security notes

- Keep `ENCRYPTION_KEY`, API keys, and wallet private keys outside the repo.
- Dashboard authentication exchanges the API key for a short-lived,
  encrypted `HttpOnly`, `Secure`, `SameSite=Strict` cookie.
- Redirect and webhook destinations must be public HTTPS URLs.
- The container build excludes env files, databases, PEM files, and raw keys.
- Dependency audit currently has no high or critical production advisories;
  moderate upstream advisories are tracked in CI.

Report vulnerabilities privately to the maintainer rather than opening a public
issue.

## Quality checks

```bash
npm run check       # lint + unit/contract tests + production build
cd docs && npm run build
docker compose config
```

GitHub Actions runs the application checks, docs build, production audit, and a
clean Docker build on pull requests.

## Documentation

The documentation site is published at
[temidayoxyz.github.io/opencheckout](https://temidayoxyz.github.io/opencheckout/).
Its source lives in [`docs/`](docs/).

## Project layout

```text
src/app/                    Next.js pages and route handlers
src/components/checkout/    Customer checkout UI
src/lib/checkout/           Sessions, state machine, currency, idempotency
src/lib/open-payments/      Open Payments orchestration
src/lib/merchant/           API and dashboard authentication
src/lib/webhook/            Signed webhook delivery
src/lib/crypto/             Encryption, signatures, URL safety
src/lib/db/                 SQLite and Drizzle schema
scripts/                    Setup and schema bootstrap
tests/                      Unit and public-contract regression tests
docs/                       Astro Starlight documentation
```

## License

GNU Affero General Public License v3.0. See [`LICENSE`](LICENSE).
