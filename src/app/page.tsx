import { ArrowRight, Code, Globe, Shield, Zap } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-canvas">
      {/* Hero — white canvas + oversized display type */}
      <section className="max-w-[1280px] mx-auto px-6 pt-32 pb-20 text-center">
        <img
          src="/logo-light.png"
          alt="OpenCheckout"
          className="h-20 w-auto mx-auto"
        />
        <p className="mt-6 text-[26px] font-[340] tracking-[-0.26px] leading-snug text-ink-soft max-w-[640px] mx-auto">
          Open-source, self-hosted checkout. Accept payments via the Open
          Payments protocol.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <a
            href="https://github.com/opencheckout/opencheckout"
            className="btn-primary text-lg py-3.5 px-8"
          >
            Get started for free
            <ArrowRight className="w-5 h-5" />
          </a>
          <a
            href="https://openpayments.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-lg py-3 px-8"
          >
            Learn about Open Payments
          </a>
        </div>
      </section>

      {/* Quick Start code block — cream color block */}
      <div className="max-w-[1280px] mx-auto px-6 pb-24">
        <div className="color-block color-block-cream">
          <p className="font-mono text-xs uppercase tracking-[0.6px] text-ink-soft mb-4">
            Quick Start
          </p>
          <pre className="bg-canvas rounded-lg p-6 text-base font-mono text-ink leading-relaxed overflow-x-auto border border-hairline">
            {`POST /api/checkout/sessions
Authorization: Bearer sk_xxx

{
  "mode": "payment",
  "line_items": [{
    "price_data": {
      "currency": "usd",
      "product_data": { "name": "T-shirt" },
      "unit_amount": 2000
    },
    "quantity": 1
  }],
  "success_url": "https://example.com/success",
  "cancel_url": "https://example.com/cancel"
}`}
          </pre>
          <p className="mt-4 text-sm text-ink-soft font-[320]">
            Stripe-compatible Checkout Sessions API. No third-party fees. No
            vendor lock-in.
          </p>
        </div>
      </div>

      {/* Features — three across */}
      <section className="max-w-[1280px] mx-auto px-6 pb-32">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: Globe,
              title: "Wallet Agnostic",
              body: "Works with any Open Payments-enabled bank, digital wallet, or mobile money provider.",
            },
            {
              icon: Shield,
              title: "Secured by OpenCheckout",
              body: "Ed25519 signatures on every request. AES-256 encrypted private keys at rest.",
            },
            {
              icon: Code,
              title: "Stripe-Compatible API",
              body: "Drop-in replacement. Same checkout sessions API your developers already know.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="feature-tile bg-surface-soft rounded-2xl p-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-canvas mb-5">
                <Icon className="w-6 h-6 text-ink" />
              </div>
              <h3 className="text-xl font-[600] text-ink mb-2">{title}</h3>
              <p className="text-base font-[320] text-ink-soft leading-relaxed">
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Deploy — lime color block */}
      <div className="max-w-[1280px] mx-auto px-6 pb-32">
        <div className="color-block color-block-lime text-center">
          <p className="font-mono text-xs uppercase tracking-[0.6px] text-ink-soft mb-4">
            Deploy
          </p>
          <h2 className="text-[32px] font-[600] tracking-[-0.4px] leading-tight text-ink mb-4">
            One command to production
          </h2>
          <p className="text-lg font-[320] text-ink-soft mb-6 max-w-[480px] mx-auto">
            Self-host on your own infrastructure. No external services required.
          </p>
          <pre className="inline-block bg-canvas rounded-lg px-6 py-4 text-base font-mono text-ink border border-hairline">
            docker compose up -d
          </pre>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-inverse-canvas text-inverse-ink py-16 px-6">
        <div className="max-w-[1280px] mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <span className="text-lg font-[600]">OpenCheckout</span>
              <p className="text-sm text-on-inverse-soft mt-2 font-[320]">
                Open-source, self-hosted checkout.
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm text-on-inverse-soft font-[320]">
              <a
                href="https://openpayments.dev"
                className="hover:text-inverse-ink transition-colors"
              >
                Open Payments
              </a>
              <span className="text-on-inverse-soft">·</span>
              <a
                href="https://github.com/opencheckout/opencheckout"
                className="hover:text-inverse-ink transition-colors"
              >
                GitHub
              </a>
              <span className="text-on-inverse-soft">·</span>
              <span>Secured by OpenCheckout</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
