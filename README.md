# OpenCheckout

Open-source, self-hosted checkout for the web. Drop-in Stripe-compatible API. Powered by the [Open Payments](https://openpayments.dev) protocol — an open standard implemented by banks, digital wallets, and mobile money providers.

**No per-transaction fees. No vendor lock-in. No third-party payment processor.**

---

## What is OpenCheckout?

OpenCheckout gives you a hosted checkout page and a Stripe-compatible API that you run on your own infrastructure. Your customers pay with their Open Payments wallet address instead of entering credit card details.

Under the hood, OpenCheckout orchestrates the [Open Payments](https://openpayments.dev) protocol — it creates incoming payments, requests quotes, handles interactive grant consent, and issues outgoing payment instructions. It separates payment instructions from payment execution, so you can include payment functionality in your application without registering as a licensed money transmitter.

### How It Works

```
1. Your backend creates a checkout session via API
   POST /api/checkout/sessions

2. You redirect your customer to the checkout page
   https://checkout.yourdomain.com/pay/cs_xxx

3. The customer enters their wallet address URL
   (e.g., https://mybank.com/username)

4. OpenCheckout orchestrates the full Open Payments flow:
   incoming payment → quote → interactive grant → outgoing payment

5. The customer approves the payment at their bank or wallet provider

6. Payment completes → customer redirected to your success URL
   A webhook fires to your backend for server-side confirmation
```

### Architecture

```
┌─────────────────────────────────┐
│ Your Server                     │
│                                 │
│  POST /api/checkout/sessions ◄──┼──── Your Backend
│                                 │
│  GET /pay/cs_xxx               ◄──┼──── Customer Browser
│                                 │
│  ┌───────────────────────────┐ │
│  │ OpenCheckout Engine       │ │
│  │                           │ │
│  │  Incoming Payment ────────┼─┼──► Merchant's ASE (receives funds)
│  │  Quote ───────────────────┼─┼──► Customer's ASE (confirms cost)
│  │  Outgoing Payment ────────┼─┼──► Customer's ASE (sends funds)
│  │                           │ │
│  │  SQLite DB + Webhooks     │ │
│  └───────────────────────────┘ │
│                                 │
│  /dashboard                    │   Merchant Dashboard
└─────────────────────────────────┘
```

---

## Features

- **Stripe-compatible checkout sessions API** — same endpoint shape, same idempotency headers, same response format
- **Wallet-agnostic** — works with any bank, digital wallet, or mobile money provider that implements Open Payments
- **Cross-currency** — customers can pay in their currency; recipients receive in theirs
- **Interactive payment consent** — customers approve payments at their own financial institution via the GNAP protocol
- **Merchant dashboard** — transaction list, API key management, webhook configuration
- **Webhook delivery** — HMAC-SHA256 signed events with automatic retries
- **Ed25519 request signing** — every request to the Open Payments API is cryptographically signed
- **AES-256-GCM encryption** — merchant private keys encrypted at rest
- **Idempotency keys** — `Idempotency-Key` header prevents duplicate session creation
- **Self-hosted** — one `docker compose up` command to deploy
- **Zero external dependencies** — SQLite database, no Redis, no Postgres, no cloud services

---

## Prerequisites

- **Node.js 22 or later**
- **npm 10 or later**
- **Docker** (for production deployment)
- An **Open Payments wallet address** with developer keys

### Getting a test wallet

For development and testing, create a free account on the Interledger test network:

1. Visit [wallet.interledger-test.dev](https://wallet.interledger-test.dev)
2. Click **Create account** and follow the registration steps
3. Complete the identity verification steps
4. Click **New account** to create a wallet and choose an asset (e.g., USD or EUR)
5. Click **Deposit** to add play money to your wallet
6. Click **Add wallet address** and give it a name (e.g., `mystore`)
7. Go to **Settings → Developer Keys** and click **Generate public & private key**
8. Save the downloaded `private.key` file — you will need it for OpenCheckout

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/temidayoxyz/opencheckout
cd opencheckout

# Install dependencies
npm install

# Create your environment file
cat > .env.local << 'EOF'
DATABASE_URL=data/opencheckout.db
ENCRYPTION_KEY=$(openssl rand -hex 32)
BASE_URL=http://localhost:3000
EOF

# Run the setup wizard
# You will need: your wallet address URL, key ID, and path to private key
npm run setup

# Start the development server
npm run dev
```

The setup wizard creates a merchant record, encrypts your private key, and outputs an API key. **Save this API key immediately** — it will not be displayed again.

Open `http://localhost:3000/dashboard` and sign in with your API key to access the merchant dashboard.

---

## Creating Your First Checkout Session

```bash
curl -X POST http://localhost:3000/api/checkout/sessions \
  -H "Authorization: Bearer sk_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: your-unique-idempotency-key" \
  -d '{
    "mode": "payment",
    "line_items": [
      {
        "price_data": {
          "currency": "usd",
          "product_data": {
            "name": "T-shirt",
            "description": "100% organic cotton"
          },
          "unit_amount": 2000
        },
        "quantity": 1
      }
    ],
    "success_url": "https://yourstore.com/order/123/success?session_id={CHECKOUT_SESSION_ID}",
    "cancel_url": "https://yourstore.com/order/123/cart",
    "metadata": {
      "order_id": "123"
    }
  }'
```

The response includes a `url` field. Redirect your customer to that URL to complete the payment.

When the payment completes, the customer sees an OpenCheckout confirmation page, then is automatically forwarded to your `success_url` with `?session_id=cs_xxx&status=complete` appended.

---

## API Authentication

All `/api/checkout` endpoints require an API key passed as a Bearer token:

```
Authorization: Bearer sk_YOUR_API_KEY
```

API keys are created and managed from the merchant dashboard at `/dashboard/keys`. You can create multiple keys (e.g., "Production", "Development") and revoke them individually.

Keys are hashed with SHA-256 before storage and never stored in plaintext.

---

## Deployment

### Docker

```bash
# Set required environment variables
export ENCRYPTION_KEY=$(openssl rand -hex 32)
export BASE_URL=https://checkout.yourdomain.com

# Start
docker compose up -d
```

OpenCheckout runs on port `3080` inside the container.

### Manual Deployment

```bash
npm ci
npm run build
ENCRYPTION_KEY=$(openssl rand -hex 32) \
BASE_URL=https://checkout.yourdomain.com \
npm start
```

### Reverse Proxy

Always place OpenCheckout behind a reverse proxy that terminates TLS. Wallet addresses require HTTPS.

```nginx
server {
    listen 443 ssl;
    server_name checkout.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Documentation

Full documentation is available at [opencheckout.dev](https://opencheckout.dev) (source in `docs/`):

- [Getting Started](https://opencheckout.dev/getting-started) — wallet setup, installation, configuration
- [API Reference](https://opencheckout.dev/api-reference) — complete endpoint documentation with request/response schemas
- [Integration Guide](https://opencheckout.dev/integration-guide) — backend and frontend integration patterns for ecommerce, donations, subscriptions, and marketplaces
- [Dashboard Guide](https://opencheckout.dev/dashboard-guide) — how to use the merchant dashboard
- [Architecture](https://opencheckout.dev/architecture) — how OpenCheckout works internally
- [Security](https://opencheckout.dev/security) — key management, request signing, encryption, and webhook verification
- [Deployment](https://opencheckout.dev/deployment) — Docker, manual, reverse proxy, and database backup
- [FAQ](https://opencheckout.dev/faq) — common questions

---

## Project Structure

```
opencheckout/
├── src/
│   ├── app/
│   │   ├── api/checkout/sessions/     # Merchant API endpoints
│   │   ├── api/dashboard/             # Dashboard API endpoints
│   │   ├── api/health/                # Health check endpoint
│   │   ├── pay/[sessionId]/           # Customer checkout page + grant callback
│   │   └── dashboard/                 # Merchant dashboard UI
│   ├── lib/
│   │   ├── checkout/                  # Session management, state machine, idempotency
│   │   ├── open-payments/             # Open Payments SDK orchestration
│   │   ├── merchant/                  # Authentication and onboarding
│   │   ├── webhook/                   # Webhook delivery and signature verification
│   │   ├── crypto/                    # AES-256-GCM, HMAC, ID generation
│   │   └── db/                        # Drizzle ORM schemas and connection
│   ├── components/checkout/           # Checkout page UI components
│   └── middleware.ts                  # Security headers and CORS
├── docs/                              # Starlight documentation site
├── scripts/setup.mjs                  # Merchant setup wizard
├── docker-compose.yml
├── Dockerfile
└── .github/workflows/                 # CI/CD
```

---

## License

GNU Affero General Public License v3.0. See [LICENSE](LICENSE).

If you modify OpenCheckout and make it available as a network service, you must make your modifications available under the same license.
