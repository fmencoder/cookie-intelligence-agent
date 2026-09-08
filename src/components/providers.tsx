"use client";

/**
 * Wallet + connection wiring for Cookie Chain.
 *
 * Uses the official Solana wallet-adapter stack with Nightly's official
 * adapter, pointed at Cookie Chain's RPC. Because Cookie Chain is an SVM
 * chain, this is the same verified integration path Solana dapps use — only
 * the endpoint differs.
 */

import { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { NightlyWalletAdapter } from "@solana/wallet-adapter-nightly";
import { COOKIE_RPC_URL, COOKIE_WSS_URL } from "@/lib/cookie-chain";

export function Providers({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(() => [new NightlyWalletAdapter()], []);

  return (
    <ConnectionProvider
      endpoint={COOKIE_RPC_URL}
      config={{ commitment: "confirmed", wsEndpoint: COOKIE_WSS_URL }}
    >
      {/* autoConnect is off by default: connecting a wallet should always be
          a deliberate user action, never something the page does on load. */}
      <WalletProvider wallets={wallets} autoConnect={false}>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
