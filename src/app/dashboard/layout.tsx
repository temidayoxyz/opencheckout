"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Receipt, Key, Settings, LogOut } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/dashboard") return;

    let active = true;

    async function checkSession() {
      try {
        const response = await fetch("/api/dashboard/session", {
          cache: "no-store",
        });
        if (active && response.status === 401) router.replace("/dashboard");
      } catch {
        if (active) router.replace("/dashboard");
      }
    }

    void checkSession();
    return () => {
      active = false;
    };
  }, [pathname, router]);

  async function logout() {
    await fetch("/api/dashboard/session", { method: "DELETE" });
    router.replace("/dashboard");
    router.refresh();
  }

  const navItems = [
    { label: "Transactions", href: "/dashboard", icon: Receipt },
    { label: "API Keys", href: "/dashboard/keys", icon: Key },
    { label: "Settings", href: "/dashboard/settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-canvas liquid-bg">
      <nav className="sticky top-0 z-10 border-b border-white/60 bg-white/60 backdrop-blur-2xl">
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-3 flex flex-col gap-3 md:h-16 md:flex-row md:items-center md:justify-between md:py-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-8">
            <Image
              src="/logo-light.png"
              alt="OpenCheckout"
              width={873}
              height={286}
              priority
              className="h-12 w-auto"
            />
            <div className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-white/70 bg-white/55 p-1 shadow-[0_12px_40px_rgba(17,24,39,0.08)] backdrop-blur-xl">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex shrink-0 items-center gap-2 px-3 py-1.5 rounded-full text-sm font-[400] transition-colors ${
                      active
                        ? "bg-primary text-on-primary"
                        : "text-ink-soft hover:bg-white/70 hover:text-ink"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 self-start rounded-full px-3 py-2 text-sm text-ink-soft hover:bg-white/70 hover:text-ink font-[400] transition-colors md:self-auto"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-12">
        {children}
      </main>
    </div>
  );
}
