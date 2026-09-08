"use client";

/** Orchestrates the fetch → analyse → render cycle for the connected wallet. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { AlertTriangle, ArrowUpRight, Cookie, Eye, RefreshCw, Wallet, X } from "lucide-react";
import { Button, Card, CardContent, Skeleton } from "@/components/ui/primitives";
import { NetworkGate } from "@/components/network-gate";
import { WalletBar } from "@/components/wallet-bar";
import { AiPanel } from "@/components/ai-panel";
import { SendPanel } from "@/components/send-panel";
import {
  ActivityPanel,
  AssetsPanel,
  ConcentrationPanel,
  OverviewPanel,
  VitalsPanel,
} from "@/components/panels";
import { WatchInput } from "@/components/watch-input";
import { fetchWalletSnapshot } from "@/lib/rpc";
import { analyseWallet } from "@/lib/intelligence";
import { COOKIE_RPC_URL, shortAddress } from "@/lib/cookie-chain";
import type { WalletSnapshot } from "@/lib/types";

export function Dashboard() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();

  const [snapshot, setSnapshot] = useState<WalletSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [watched, setWatched] = useState<string | null>(null);

  // Deep links (`/?address=…`) make an analysis shareable.
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("address");
    if (!param) return;
    try {
      new PublicKey(param);
      setWatched(param);
    } catch {
      /* ignore an unparseable address in the URL */
    }
  }, []);

  // A connected wallet always wins over a watched address.
  const target = useMemo(() => {
    if (publicKey) return publicKey;
    if (watched) {
      try {
        return new PublicKey(watched);
      } catch {
        return null;
      }
    }
    return null;
  }, [publicKey, watched]);

  const isOwnWallet = Boolean(publicKey);

  const watch = useCallback((address: string) => {
    setWatched(address);
    setSnapshot(null);
    const url = new URL(window.location.href);
    url.searchParams.set("address", address);
    window.history.replaceState(null, "", url);
  }, []);

  const clearWatch = useCallback(() => {
    setWatched(null);
    setSnapshot(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("address");
    window.history.replaceState(null, "", url);
  }, []);

  const load = useCallback(async () => {
    if (!target) {
      setSnapshot(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await fetchWalletSnapshot(connection, target));
    } catch (err) {
      setError(
        err instanceof Error
          ? `Could not load wallet data from ${COOKIE_RPC_URL}: ${err.message}`
          : "Could not load wallet data from Cookie Chain.",
      );
    } finally {
      setLoading(false);
    }
  }, [connection, target]);

  useEffect(() => {
    void load();
  }, [load]);

  const analysis = useMemo(
    () => (snapshot ? analyseWallet(snapshot) : null),
    [snapshot],
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
      <Header onRefresh={load} loading={loading} active={Boolean(target)} />

      <NetworkGate>
        {!target ? (
          <Landing onWatch={watch} />
        ) : loading && !snapshot ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : snapshot && analysis ? (
          <>
            {snapshot.warnings.length > 0 ? (
              <div
                className="mb-4 space-y-1 rounded-lg border px-3 py-2 text-xs"
                style={{ background: "var(--accent-soft)" }}
                role="status"
              >
                {snapshot.warnings.map((w) => (
                  <div key={w} className="flex items-start gap-2">
                    <AlertTriangle
                      className="mt-0.5 h-3.5 w-3.5 shrink-0"
                      style={{ color: "var(--accent)" }}
                    />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {!isOwnWallet && watched ? (
              <div
                className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs"
                style={{ background: "var(--panel-alt)" }}
              >
                <span className="flex items-center gap-2">
                  <Eye className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
                  Read-only view of{" "}
                  <code className="font-mono">{shortAddress(watched, 6, 6)}</code>
                  <span style={{ color: "var(--muted)" }}>
                    — connect a wallet to send COOK.
                  </span>
                </span>
                <button onClick={clearWatch} className="inline-flex items-center gap-1 underline" style={{ color: "var(--muted)" }}>
                  <X className="h-3 w-3" />
                  Clear
                </button>
              </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="min-w-0 space-y-4 lg:col-span-2">
                <OverviewPanel analysis={analysis} />
                <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                  <ConcentrationPanel analysis={analysis} />
                  <VitalsPanel vitals={snapshot.vitals} />
                </div>
                <AssetsPanel snapshot={snapshot} />
                <ActivityPanel snapshot={snapshot} analysis={analysis} />
              </div>

              <div className="min-w-0 space-y-4">
                <AiPanel snapshot={snapshot} />
                {isOwnWallet ? (
                  <SendPanel
                    balanceCook={snapshot.nativeBalanceCook}
                    onConfirmed={load}
                  />
                ) : (
                  <ConnectToSendCard />
                )}
              </div>
            </div>
          </>
        ) : null}
      </NetworkGate>

      <Footer />
    </div>
  );
}

/** Shown in read-only mode where the send panel would otherwise sit. */
function ConnectToSendCard() {
  return (
    <Card>
      <CardContent className="px-5 py-6 text-center">
        <span
          className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: "var(--accent-soft)" }}
          aria-hidden
        >
          <ArrowUpRight className="h-5 w-5" style={{ color: "var(--accent)" }} />
        </span>
        <h3 className="text-sm font-semibold">Send COOK</h3>
        <p className="mx-auto mt-1.5 max-w-xs text-xs" style={{ color: "var(--muted)" }}>
          You are viewing this wallet read-only. Connect Nightly to send COOK with an
          on-chain memo, approved in your wallet and tracked to confirmation.
        </p>
      </CardContent>
    </Card>
  );
}

function Header({
  onRefresh,
  loading,
  active,
}: {
  onRefresh: () => void;
  loading: boolean;
  active: boolean;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: "var(--accent-soft)" }}
          aria-hidden
        >
          <Cookie className="h-5 w-5" style={{ color: "var(--accent)" }} />
        </span>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Cookie Intelligence Agent
          </h1>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            AI wallet intelligence for Cookie Chain
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {active ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={onRefresh}
            disabled={loading}
            title="Refresh on-chain data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin-slow" : ""}`} />
            <span className="sr-only sm:not-sr-only">Refresh</span>
          </Button>
        ) : null}
        <WalletBar />
      </div>
    </header>
  );
}

function Landing({ onWatch }: { onWatch: (address: string) => void }) {
  return (
    <Card className="animate-rise">
      <CardContent className="px-6 py-14 text-center">
        <span
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: "var(--accent-soft)" }}
          aria-hidden
        >
          <Wallet className="h-7 w-7" style={{ color: "var(--accent)" }} />
        </span>
        <h2 className="text-xl font-semibold tracking-tight">
          Connect your wallet to begin
        </h2>
        <p
          className="mx-auto mt-2 max-w-md text-sm leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          Cookie Intelligence Agent reads your balances, assets and transaction history
          straight from Cookie Chain, computes portfolio concentration and activity
          metrics, and lets you ask questions in plain language — answered only from data
          it actually fetched.
        </p>

        <div className="mx-auto mt-6 grid max-w-2xl gap-3 text-left sm:grid-cols-3">
          {[
            ["Read", "Balances, SPL assets and recent transactions from the Cookie Chain RPC."],
            ["Understand", "Concentration (HHI), net flows, fees, counterparties and asset activity."],
            ["Act", "Send COOK with an on-chain memo, approved in your wallet, tracked to confirmation."],
          ].map(([title, body]) => (
            <div
              key={title}
              className="rounded-lg border p-3"
              style={{ background: "var(--panel-alt)" }}
            >
              <div className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
                {title}
              </div>
              <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                {body}
              </div>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-7 max-w-md">
          <div
            className="mb-2 text-[11px] uppercase tracking-wide"
            style={{ color: "var(--muted)" }}
          >
            or explore without connecting
          </div>
          <WatchInput onWatch={onWatch} />
        </div>

        <p className="mt-6 text-[11px]" style={{ color: "var(--muted)" }}>
          Sending COOK requires the Nightly wallet set to Cookie Chain. This app never
          asks for a seed phrase or private key.
        </p>
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Skeleton className="h-40 w-full" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-52 w-full" />
          <Skeleton className="h-52 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card>
      <CardContent className="px-6 py-12 text-center">
        <AlertTriangle className="mx-auto h-8 w-8" style={{ color: "var(--neg)" }} />
        <h2 className="mt-3 text-base font-semibold">Could not load wallet data</h2>
        <p
          className="mx-auto mt-2 max-w-lg text-xs leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          {message}
        </p>
        <Button className="mt-4" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}

function Footer() {
  return (
    <footer
      className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-[11px]"
      style={{ color: "var(--muted)" }}
    >
      <span>
        Data read live from <code className="font-mono">{COOKIE_RPC_URL}</code>
      </span>
      <span className="flex items-center gap-3">
        <a className="underline" href="https://cookiescan.io" target="_blank" rel="noreferrer">
          CookieScan
        </a>
        <a className="underline" href="https://docs.cookiechain.wtf" target="_blank" rel="noreferrer">
          Cookie Chain docs
        </a>
      </span>
    </footer>
  );
}
