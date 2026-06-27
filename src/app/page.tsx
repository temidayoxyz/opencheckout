import { ArrowRight, Code, Globe, Shield } from "lucide-react";
import Image from "next/image";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-canvas liquid-bg">
      {/* Hero — white canvas + oversized display type */}
      <section className="max-w-[1280px] mx-auto px-6 pt-32 pb-20 text-center">
        <Image
          src="/logo-light.png"
          alt="OpenCheckout"
          width={873}
          height={286}
          priority
          className="h-20 w-auto mx-auto"
        />
        <p className="mt-6 text-[26px] font-[340] tracking-[-0.26px] leading-snug text-ink-soft max-w-[640px] mx-auto">
          Accept payments through the Open Payments protocol with a checkout
          flow customers can complete from any supported wallet, bank, or
          mobile money account.
        </p>
        <div className="mx-auto mt-10 flex w-full max-w-sm flex-col items-stretch justify-center gap-3 sm:max-w-none sm:flex-row sm:items-center sm:gap-4">
          <a
            href="https://github.com/temidayoxyz/opencheckout"
            className="btn-primary w-full justify-center whitespace-nowrap px-6 py-3.5 text-base sm:w-auto sm:px-8 sm:text-lg"
          >
            Get started for free
            <ArrowRight className="w-5 h-5" />
          </a>
          <a
            href="/dashboard"
            className="btn-secondary w-full justify-center whitespace-nowrap px-6 py-3.5 text-base sm:w-auto sm:px-8 sm:py-3 sm:text-lg"
          >
            Open dashboard
          </a>
        </div>
      </section>

      {/* Quick Start code block — cream color block */}
      <div className="max-w-[1280px] mx-auto px-6 pb-24">
        <div className="color-block color-block-cream">
          <p className="font-mono text-xs uppercase tracking-[0.6px] text-ink-soft mb-4">
            Quick Start
          </p>
          <pre className="glass-panel rounded-2xl p-6 text-base font-mono text-ink leading-relaxed overflow-x-auto">
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
            No OpenCheckout transaction fees. No vendor lock-in.
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
              title: "Cryptographic Security",
              body: "Every payment request is verified, and sensitive merchant keys stay protected at rest.",
            },
            {
              icon: Code,
              title: "REST API",
              body: "Start a checkout, track its progress, and return customers to your store when payment is complete.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="feature-tile glass-panel rounded-2xl p-6">
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
            Bring the full checkout stack online in minutes, with payments,
            webhooks, and keys running in your own environment.
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
              <Image
                src="/logo-dark.png"
                alt="OpenCheckout"
                width={190}
                height={70}
                unoptimized
                className="h-12 w-auto"
              />
              <p className="text-sm text-white/50 mt-2 font-[320]">
                Payments that stay in your flow through the Open Payments
                protocol.
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm text-white/50 font-[320]">
              <a
                href="https://openpayments.dev"
                className="hover:text-inverse-ink transition-colors"
              >
                Open Payments
              </a>
              <span className="text-white/50">·</span>
              <a
                href="https://github.com/temidayoxyz/opencheckout"
                className="hover:text-inverse-ink transition-colors"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
