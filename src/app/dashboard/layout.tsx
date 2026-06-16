"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Receipt, Key, Settings, LogOut } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cookies = document.cookie.split("; ");
    const authCookie = cookies.find((c) => c.startsWith("oc_api_key="));
    if (!authCookie && pathname !== "/dashboard") {
      router.replace("/dashboard");
      return;
    }
    setLoading(false);
  }, [pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  function logout() {
    document.cookie = "oc_api_key=; Max-Age=0; path=/";
    router.replace("/dashboard");
  }

  const navItems = [
    { label: "Transactions", href: "/dashboard", icon: Receipt },
    { label: "API Keys", href: "/dashboard/keys", icon: Key },
    { label: "Settings", href: "/dashboard/settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-canvas">
      {/* Top nav — clean monochrome bar */}
      <nav className="sticky top-0 z-10 bg-canvas border-b border-hairline h-14 flex items-center">
        <div className="max-w-5xl mx-auto w-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <img
              src="/logo-light.png"
              alt="OpenCheckout"
              className="h-16 w-auto"
            />
            <div className="flex gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-[400] transition-colors ${
                      active
                        ? "bg-primary text-on-primary"
                        : "text-ink-soft hover:text-ink"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </a>
                );
              })}
            </div>
          </div>
          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink font-[400] transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-12">{children}</main>
    </div>
  );
}
