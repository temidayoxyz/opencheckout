"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, RefreshCw, Copy, Check } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [secretMasked, setSecretMasked] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showNewSecret, setShowNewSecret] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/dashboard/settings", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => {
        if (response.status === 401) {
          router.replace("/dashboard");
          return null;
        }
        if (!response.ok) throw new Error("Failed to load settings");
        return response.json();
      })
      .then((data) => {
        if (!data) return;
        setWebhookUrl(data.webhook_url || "");
        setSecretMasked(data.webhook_secret_masked || "");
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setMessage("Failed to load settings.");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [router]);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/dashboard/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ webhook_url: webhookUrl }),
      });
      if (res.ok) setMessage("Settings saved.");
    } catch {
      setMessage("Failed to save.");
    }
    setSaving(false);
  }

  async function regenerateSecret() {
    if (!confirm("Regenerate the webhook secret? Old one stops working.")) return;
    try {
      const res = await fetch("/api/dashboard/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ regenerate_secret: true }),
      });
      const data = await res.json();
      if (data.webhook_secret) {
        setShowNewSecret(data.webhook_secret);
        setSecretMasked(data.webhook_secret.substring(0, 8) + "…");
      }
    } catch {
      setMessage("Failed to regenerate.");
    }
  }

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[26px] font-[600] tracking-[-0.26px] text-ink mb-8">
        Settings
      </h1>

      {showNewSecret && (
        <div className="mb-8 color-block color-block-lime">
          <p className="font-[600] text-ink mb-1">New webhook secret</p>
          <p className="text-sm text-ink-soft mb-4 font-[320]">
            Copy it now — it won&apos;t be shown again.
          </p>
          <div className="flex items-center gap-3 bg-canvas rounded-lg px-4 py-3 border border-hairline">
            <code className="flex-1 font-mono text-sm text-ink select-all break-all">
              {showNewSecret}
            </code>
            <button
              onClick={() => copyToClipboard(showNewSecret)}
              className="p-2 rounded-full hover:bg-surface-soft transition-colors shrink-0"
            >
              {copied ? (
                <Check className="w-4 h-4 text-success" />
              ) : (
                <Copy className="w-4 h-4 text-ink-soft" />
              )}
            </button>
          </div>
          <button
            onClick={() => setShowNewSecret("")}
            className="mt-3 text-sm text-ink-soft hover:text-ink font-[400]"
          >
            Dismiss
          </button>
        </div>
      )}

      {message && (
        <div className="mb-6 color-block color-block-mint py-3 px-5">
          <p className="text-sm font-[400] text-ink">{message}</p>
        </div>
      )}

      <div className="card-hairline p-6">
        <form onSubmit={saveSettings}>
          <p className="font-mono text-xs uppercase tracking-[0.6px] text-ink-soft mb-3">
            Webhook URL
          </p>
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://yourstore.com/webhooks/opencheckout"
            className="block w-full rounded-lg border border-hairline bg-canvas px-4 py-2.5 text-base font-[320] focus:outline-none focus:ring-2 focus:ring-primary/20 mb-3"
          />
          <p className="text-sm text-ink-soft font-[320] mb-4">
            Events are POSTed here when checkout sessions complete.
          </p>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary py-2.5 text-base disabled:opacity-30"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving…" : "Save"}
          </button>
        </form>

        <hr className="my-8 border-hairline" />

        <div>
          <p className="font-mono text-xs uppercase tracking-[0.6px] text-ink-soft mb-3">
            Webhook Secret
          </p>
          <div className="flex items-center gap-3">
            <code className="flex-1 bg-surface-soft rounded-lg px-4 py-2.5 text-base font-mono text-ink-soft select-all">
              {secretMasked || "Not set"}
            </code>
            <button
              onClick={regenerateSecret}
              className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-accent-magenta font-[400] transition-colors shrink-0"
            >
              <RefreshCw className="w-4 h-4" />
              Regenerate
            </button>
          </div>
          <p className="text-sm text-ink-soft mt-3 font-[320]">
            Verify webhook signatures with HMAC-SHA256 using this secret.
          </p>
        </div>
      </div>
    </div>
  );
}
