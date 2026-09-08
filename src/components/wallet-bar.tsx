"use client";

/** Connect / disconnect control plus the connected address chip. */

import { useCallback, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Copy, ExternalLink, LogOut, Check, Wallet } from "lucide-react";
import { Button, Badge } from "@/components/ui/primitives";
import { explorerAddressUrl, shortAddress } from "@/lib/cookie-chain";

const NIGHTLY_INSTALL_URL = "https://nightly.app/download";

export function WalletBar() {
  const { publicKey, connected, connecting, connect, disconnect, select, wallet } =
    useWallet();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = useCallback(async () => {
    setError(null);
    try {
      // Only Nightly is registered, so it can be selected without a modal.
      if (!wallet) select("Nightly" as never);
      await connect();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(
        /not (be )?(found|detected)|no wallet|undefined/i.test(message)
          ? "Nightly wallet was not detected in this browser."
          : message.includes("User rejected")
            ? "Connection request was rejected in the wallet."
            : message,
      );
    }
  }, [connect, select, wallet]);

  const handleCopy = useCallback(async () => {
    if (!publicKey) return;
    await navigator.clipboard.writeText(publicKey.toBase58());
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }, [publicKey]);

  if (!connected || !publicKey) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <Button onClick={handleConnect} disabled={connecting}>
          <Wallet className="h-4 w-4" aria-hidden />
          {connecting ? "Connecting…" : "Connect Nightly"}
        </Button>
        {error ? (
          <p className="max-w-xs text-right text-xs" style={{ color: "var(--neg)" }}>
            {error}{" "}
            <a
              className="underline"
              href={NIGHTLY_INSTALL_URL}
              target="_blank"
              rel="noreferrer"
            >
              Install Nightly
            </a>
          </p>
        ) : null}
      </div>
    );
  }

  const address = publicKey.toBase58();

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Badge tone="accent" className="font-mono">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--pos)" }} />
        {shortAddress(address, 5, 5)}
      </Badge>
      <Button size="sm" variant="secondary" onClick={handleCopy} title="Copy address">
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        <span className="sr-only sm:not-sr-only">{copied ? "Copied" : "Copy"}</span>
      </Button>
      <a href={explorerAddressUrl(address)} target="_blank" rel="noreferrer">
        <Button size="sm" variant="secondary" title="View on CookieScan">
          <ExternalLink className="h-3.5 w-3.5" />
          <span className="sr-only sm:not-sr-only">CookieScan</span>
        </Button>
      </a>
      <Button size="sm" variant="ghost" onClick={() => void disconnect()} title="Disconnect">
        <LogOut className="h-3.5 w-3.5" />
        <span className="sr-only sm:not-sr-only">Disconnect</span>
      </Button>
    </div>
  );
}
