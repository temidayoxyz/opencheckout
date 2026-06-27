"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Copy, Check } from "lucide-react";

interface ApiKeyRecord {
  id: string;
  name: string;
  createdAt: string;
  revokedAt: string | null;
}

export default function KeysPage() {
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newKey, setNewKey] = useState<{ name: string; plaintext: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const loadKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/keys", { cache: "no-store" });
      if (res.status === 401) {
        router.replace("/dashboard");
        return;
      }
      if (!res.ok) throw new Error("Failed to load keys");
      setKeys((await res.json()).keys);
    } catch {
      setError("Failed to load keys");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void Promise.resolve().then(loadKeys);
  }, [loadKeys]);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const name = (document.getElementById("key-name") as HTMLInputElement).value;
    try {
      const res = await fetch("/api/dashboard/keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewKey(data);
        await loadKeys();
        (document.getElementById("key-name") as HTMLInputElement).value = "";
      } else {
        setError((await res.json()).error?.message ?? "Failed to create key");
      }
    } catch {
      setError("Failed to create key");
    }
  }

  async function revokeKey(keyId: string) {
    if (!confirm("Revoke this key? It will stop working immediately.")) return;
    const response = await fetch(`/api/dashboard/keys?id=${keyId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error?.message ?? "Failed to revoke key");
      return;
    }
    await loadKeys();
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
        API Keys
      </h1>

      {newKey && (
        <div className="mb-8 color-block color-block-lime">
          <p className="font-[600] text-ink mb-1">New key created</p>
          <p className="text-sm text-ink-soft mb-4 font-[320]">
            Copy it now — it won&apos;t be shown again.
          </p>
          <div className="flex items-center gap-3 bg-canvas rounded-lg px-4 py-3 border border-hairline">
            <code className="flex-1 font-mono text-sm text-ink select-all break-all">
              {newKey.plaintext}
            </code>
            <button
              onClick={() => copyToClipboard(newKey.plaintext)}
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
            onClick={() => setNewKey(null)}
            className="mt-3 text-sm text-ink-soft hover:text-ink font-[400]"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="card-hairline p-4 mb-8">
        <form onSubmit={createKey} className="flex gap-3">
          <input
            id="key-name"
            type="text"
            placeholder="Key name (e.g. Production)"
            className="flex-1 rounded-lg border border-hairline bg-canvas px-4 py-2.5 text-base font-[320] focus:outline-none focus:ring-2 focus:ring-primary/20"
            required
          />
          <button
            type="submit"
            className="btn-primary py-2.5 text-base shrink-0"
          >
            <Plus className="w-4 h-4" />
            Create Key
          </button>
        </form>
        {error && (
          <p className="mt-3 text-sm text-accent-magenta font-[400]">{error}</p>
        )}
      </div>

      <div className="card-hairline overflow-hidden">
        <div className="table-scroll">
        <table className="w-full text-base">
          <thead>
            <tr className="border-b border-hairline text-left">
              <th className="px-5 py-4 font-mono text-xs uppercase tracking-[0.6px] text-ink-soft font-[400]">
                Name
              </th>
              <th className="px-5 py-4 font-mono text-xs uppercase tracking-[0.6px] text-ink-soft font-[400]">
                Key ID
              </th>
              <th className="px-5 py-4 font-mono text-xs uppercase tracking-[0.6px] text-ink-soft font-[400]">
                Created
              </th>
              <th className="px-5 py-4 font-mono text-xs uppercase tracking-[0.6px] text-ink-soft font-[400]">
                Status
              </th>
              <th className="px-5 py-4" />
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-ink-soft font-[320]">
                  No API keys yet.
                </td>
              </tr>
            ) : (
              keys.map((k) => (
                <tr key={k.id} className="border-b border-hairline-soft">
                  <td className="px-5 py-4 font-[500] text-ink">{k.name}</td>
                  <td className="px-5 py-4 font-mono text-sm text-ink-soft">
                    {k.id}
                  </td>
                  <td className="px-5 py-4 text-ink-soft text-sm font-[320]">
                    {new Date(k.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-[400] ${
                        k.revokedAt
                          ? "bg-block-pink text-ink"
                          : "bg-block-mint text-ink"
                      }`}
                    >
                      {k.revokedAt ? "Revoked" : "Active"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {!k.revokedAt && (
                      <button
                        onClick={() => revokeKey(k.id)}
                        className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-accent-magenta font-[400] transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
