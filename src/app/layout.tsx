import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Cookie Intelligence Agent — AI wallet intelligence for Cookie Chain",
  description:
    "Connect a Nightly wallet to read live Cookie Chain balances, assets, portfolio concentration and transaction history, ask questions in plain language, and send COOK — with every answer grounded in real on-chain data.",
  openGraph: {
    title: "Cookie Intelligence Agent",
    description:
      "AI-powered wallet intelligence for Cookie Chain. Real on-chain data, no hallucinated balances.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f3ec" },
    { media: "(prefers-color-scheme: dark)", color: "#14100b" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
