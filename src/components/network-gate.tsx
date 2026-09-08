"use client";

/**
 * Network validation.
 *
 * A wallet connected to the wrong SVM network would render believable-looking
 * but wrong data, and would sign transactions against the wrong chain. So the
 * genesis hash Nightly reports is compared against the genesis hash of the RPC
 * this app is configured for, and the dashboard is blocked on mismatch.
 */

import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AlertTriangle, Check, Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { COOKIE_DOCS_URL, COOKIE_RPC_URL } from "@/lib/cookie-chain";

type State = "idle" | "checking" | "match" | "mismatch" | "unknown";

type NightlyWindow = Window & {
  nightly?: { solana?: { genesisHash?: string } };
};

export function NetworkGate({ children }: { children: React.ReactNode }) {
  const { connection } = useConnection();
  const { connected } = useWallet();
  const [state, setState] = useState<State>("idle");
  const [detail, setDetail] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const check = useCallback(async () => {
    if (!connected) {
      setState("idle");
      setDetail(null);
      return;
    }

    setState("checking");
    setDetail(null);

    try {
      const expected = await connection.getGenesisHash();
      const reported = (window as NightlyWindow).nightly?.solana?.genesisHash;

      if (!reported) {
        // Not every Nightly build exposes the active network. Rather than
        // block a legitimate user on a missing field, this degrades to a
        // visible warning and lets them proceed deliberately.
        setState("unknown");
        setDetail(
          "Nightly did not report its active SVM network, so it could not be verified automatically.",
        );
        return;
      }

      setState(reported === expected ? "match" : "mismatch");
      if (reported !== expected) {
        setDetail(`Wallet genesis ${reported.slice(0, 8)}… ≠ Cookie Chain genesis ${expected.slice(0, 8)}…`);
      }
    } catch (err) {
      setState("unknown");
      setDetail(
        err instanceof Error
          ? `Could not reach the Cookie Chain RPC to verify the network: ${err.message}`
          : "Could not verify the active network.",
      );
    }
  }, [connected, connection]);

  useEffect(() => {
    void check();
  }, [check]);

  const copyRpc = useCallback(async () => {
    await navigator.clipboard.writeText(COOKIE_RPC_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }, []);

  const blocking = connected && state === "mismatch";

  return (
    <>
      {state === "unknown" && connected ? (
        <div
          className="mb-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs animate-rise"
          style={{ background: "var(--accent-soft)", color: "var(--text)" }}
          role="status"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--accent)" }} />
          <span>
            {detail} Data below is read live from{" "}
            <code className="font-mono">{COOKIE_RPC_URL}</code>; confirm your wallet is on
            Cookie Chain before sending a transaction.
            <button onClick={() => void check()} className="ml-1 underline">
              Re-check
            </button>
          </span>
        </div>
      ) : null}

      <div aria-hidden={blocking || undefined} className={blocking ? "pointer-events-none blur-sm select-none" : undefined}>
        {children}
      </div>

      {blocking ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="net-gate-title"
        >
          <div
            className="w-full max-w-md rounded-xl border p-6 shadow-xl animate-rise"
            style={{ background: "var(--panel)" }}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" style={{ color: "var(--neg)" }} />
              <h2 id="net-gate-title" className="text-base font-semibold">
                Wrong network
              </h2>
            </div>

            <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
              Your wallet is connected to a different SVM network. Switch Nightly to
              Cookie Chain to continue — the dashboard stays locked so you never read
              or sign against the wrong chain.
            </p>

            {detail ? (
              <p className="mt-2 font-mono text-xs" style={{ color: "var(--muted)" }}>
                {detail}
              </p>
            ) : null}

            <ol className="mt-4 space-y-1 text-sm" style={{ color: "var(--muted)" }}>
              <li>1. Open Nightly&apos;s network selector.</li>
              <li>2. Choose <strong>Custom RPC</strong> / custom SVM network.</li>
              <li>3. Paste the Cookie Chain RPC below and select it.</li>
              <li>4. Return here and re-check.</li>
            </ol>

            <div
              className="mt-3 flex items-center gap-2 rounded-lg border px-3 py-2"
              style={{ background: "var(--panel-alt)" }}
            >
              <code className="scroll-x flex-1 font-mono text-xs">{COOKIE_RPC_URL}</code>
              <Button size="sm" variant="secondary" onClick={() => void copyRpc()}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <Button onClick={() => void check()}>
                <RefreshCw className="h-4 w-4" />
                Re-check network
              </Button>
              <a
                className="text-xs underline"
                href={`${COOKIE_DOCS_URL}/wallets`}
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--muted)" }}
              >
                Cookie Chain wallet docs ↗
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
