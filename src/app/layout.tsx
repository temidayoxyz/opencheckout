import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.BASE_URL ?? "http://localhost:3000"),
  title: "OpenCheckout",
  description:
    "Checkout orchestration for payments through the Open Payments protocol.",
  openGraph: {
    title: "OpenCheckout",
    description:
      "Checkout orchestration for payments through the Open Payments protocol.",
    type: "website",
    siteName: "OpenCheckout",
  },
  twitter: {
    card: "summary_large_image",
    title: "OpenCheckout",
    description:
      "Checkout orchestration for payments through the Open Payments protocol.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>{children}</body>
    </html>
  );
}
