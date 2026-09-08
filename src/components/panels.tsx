"use client";

/** Presentational panels for the wallet intelligence dashboard. */

import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  ChartPie,
  CircleDot,
  ExternalLink,
  Gauge,
  Info,
} from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Stat,
} from "@/components/ui/primitives";
import {
  explorerAddressUrl,
  explorerTxUrl,
  formatAmount,
  formatCompact,
  formatPercent,
  formatRelativeTime,
  shortAddress,
} from "@/lib/cookie-chain";
import type { ChainVitals, WalletAnalysis, WalletSnapshot } from "@/lib/types";

/* ------------------------------- Overview -------------------------------- */

export function OverviewPanel({ analysis }: { analysis: WalletAnalysis }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="h-4 w-4" style={{ color: "var(--accent)" }} />
          Portfolio overview
        </CardTitle>
        <CardDescription>
          Live balances and flows read from the Cookie Chain RPC.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat
            label="COOK balance"
            value={formatAmount(analysis.nativeBalanceCook)}
            hint="native"
          />
          <Stat
            label="Assets held"
            value={analysis.assetCount}
            hint={analysis.assetCount === 1 ? "1 asset" : "distinct mints"}
          />
          <Stat
            label="Net flow"
            value={`${analysis.netFlowCook >= 0 ? "+" : ""}${formatAmount(analysis.netFlowCook)}`}
            hint="COOK, sampled window"
            tone={analysis.netFlowCook > 0 ? "positive" : analysis.netFlowCook < 0 ? "negative" : undefined}
          />
          <Stat
            label="Fees paid"
            value={formatAmount(analysis.feesPaidCook, 6)}
            hint="COOK, sampled window"
          />
        </div>

        {analysis.highlights.length > 0 ? (
          <ul className="mt-4 space-y-1.5 border-t pt-3">
            {analysis.highlights.map((h, i) => (
              <li key={i} className="flex gap-2 text-xs" style={{ color: "var(--muted)" }}>
                <CircleDot className="mt-0.5 h-3 w-3 shrink-0" style={{ color: "var(--accent)" }} />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

/* ----------------------------- Concentration ----------------------------- */

export function ConcentrationPanel({ analysis }: { analysis: WalletAnalysis }) {
  const top = analysis.concentration.slice(0, 6);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ChartPie className="h-4 w-4" style={{ color: "var(--accent)" }} />
          Concentration
        </CardTitle>
        <CardDescription>
          Share of holdings by token quantity · HHI {analysis.hhi.toFixed(2)} ·{" "}
          <span style={{ color: "var(--accent)" }}>{analysis.concentrationLabel}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {top.length === 0 ? (
          <EmptyState message="No assets with a non-zero balance." />
        ) : (
          <div className="space-y-2.5">
            {top.map((bucket) => (
              <div key={bucket.mint}>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate font-medium">{bucket.symbol}</span>
                  <span className="tabular-nums" style={{ color: "var(--muted)" }}>
                    {formatPercent(bucket.share)}
                  </span>
                </div>
                <div
                  className="mt-1 h-1.5 overflow-hidden rounded-full"
                  style={{ background: "var(--accent-soft)" }}
                  role="img"
                  aria-label={`${bucket.symbol}: ${formatPercent(bucket.share)} of holdings`}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(bucket.share * 100, 1.5)}%`,
                      background: "var(--accent)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-3 flex items-start gap-1.5 text-[11px]" style={{ color: "var(--muted)" }}>
          <Info className="mt-px h-3 w-3 shrink-0" />
          Weights are by token quantity. This app uses no price oracle, so it reports no
          USD values.
        </p>
      </CardContent>
    </Card>
  );
}

/* -------------------------------- Assets --------------------------------- */

export function AssetsPanel({ snapshot }: { snapshot: WalletSnapshot }) {
  const held = snapshot.holdings.filter((h) => h.amount > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Boxes className="h-4 w-4" style={{ color: "var(--accent)" }} />
          Assets
        </CardTitle>
        <CardDescription>
          Native COOK plus every SPL token account with a balance.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {held.length === 0 ? (
          <EmptyState message="This wallet holds no assets on Cookie Chain." />
        ) : (
          <div className="scroll-x">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ color: "var(--muted)" }}>
                  <th className="pb-2 text-left font-medium">Asset</th>
                  <th className="pb-2 text-left font-medium">Mint</th>
                  <th className="pb-2 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {held.map((h) => (
                  <tr key={h.mint} className="border-t">
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                          aria-hidden
                        >
                          {h.symbol.slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{h.symbol}</div>
                          <div className="truncate" style={{ color: "var(--muted)" }}>
                            {h.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 pr-3">
                      {h.isNative ? (
                        <Badge>native</Badge>
                      ) : (
                        <a
                          href={explorerAddressUrl(h.mint)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-mono underline"
                          style={{ color: "var(--muted)" }}
                        >
                          {shortAddress(h.mint)}
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </td>
                    <td className="py-2 text-right tabular-nums font-medium">
                      {formatAmount(h.amount, 6)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------- Activity -------------------------------- */

export function ActivityPanel({
  snapshot,
  analysis,
}: {
  snapshot: WalletSnapshot;
  analysis: WalletAnalysis;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-4 w-4" style={{ color: "var(--accent)" }} />
          Recent activity
        </CardTitle>
        <CardDescription>
          {analysis.txCount} most recent transactions · last active{" "}
          {formatRelativeTime(analysis.lastActive)} · every row verifiable on CookieScan
        </CardDescription>
      </CardHeader>
      <CardContent>
        {snapshot.transactions.length === 0 ? (
          <EmptyState message="No transactions found for this wallet." />
        ) : (
          <ul className="max-h-[26rem] space-y-1 overflow-y-auto pr-1">
            {snapshot.transactions.map((tx) => {
              const positive = tx.nativeChangeCook > 0;
              return (
                <li
                  key={tx.signature}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-[var(--panel-alt)]"
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: "var(--accent-soft)",
                      color: tx.failed
                        ? "var(--neg)"
                        : positive
                          ? "var(--pos)"
                          : "var(--muted)",
                    }}
                    aria-hidden
                  >
                    {positive ? (
                      <ArrowDownLeft className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium capitalize">
                        {tx.failed ? "Failed" : tx.direction === "in" ? "Received" : tx.direction === "out" ? "Sent" : "Interaction"}
                      </span>
                      {tx.failed ? <Badge tone="negative">error</Badge> : null}
                      {tx.memo ? <Badge tone="accent">memo</Badge> : null}
                    </div>
                    <div className="truncate text-[11px]" style={{ color: "var(--muted)" }}>
                      {formatRelativeTime(tx.blockTime)}
                      {tx.counterparty ? ` · ${shortAddress(tx.counterparty)}` : ""}
                      {tx.memo ? ` · “${tx.memo}”` : ""}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div
                      className="text-xs font-semibold tabular-nums"
                      style={{
                        color: tx.nativeChangeCook === 0
                          ? "var(--muted)"
                          : positive
                            ? "var(--pos)"
                            : "var(--neg)",
                      }}
                    >
                      {tx.nativeChangeCook === 0
                        ? "—"
                        : `${positive ? "+" : ""}${formatAmount(tx.nativeChangeCook, 5)}`}
                    </div>
                    <a
                      href={explorerTxUrl(tx.signature)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-0.5 text-[10px] underline"
                      style={{ color: "var(--muted)" }}
                    >
                      {shortAddress(tx.signature, 4, 4)}
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Chain vitals ----------------------------- */

export function VitalsPanel({ vitals }: { vitals: ChainVitals | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CircleDot
            className="h-4 w-4"
            style={{ color: vitals?.healthy ? "var(--pos)" : "var(--neg)" }}
          />
          Cookie Chain
        </CardTitle>
        <CardDescription>
          Live network state from the same RPC serving this dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!vitals ? (
          <EmptyState message="Chain vitals unavailable." />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Slot" value={formatCompact(vitals.slot)} hint={`epoch ${vitals.epoch}`} />
              <Stat
                label="RPC latency"
                value={`${vitals.latencyMs} ms`}
                hint={vitals.version ? `v${vitals.version}` : "core"}
              />
            </div>
            <div className="mt-3 border-t pt-3">
              <div className="flex items-baseline justify-between text-[11px]">
                <span style={{ color: "var(--muted)" }}>Epoch progress</span>
                <span className="tabular-nums" style={{ color: "var(--muted)" }}>
                  {formatPercent(vitals.slotIndex / Math.max(vitals.slotsInEpoch, 1), 0)}
                </span>
              </div>
              <div
                className="mt-1 h-1.5 overflow-hidden rounded-full"
                style={{ background: "var(--accent-soft)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(vitals.slotIndex / Math.max(vitals.slotsInEpoch, 1)) * 100}%`,
                    background: "var(--accent)",
                  }}
                />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Shared bits ------------------------------ */

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="rounded-lg border border-dashed px-4 py-6 text-center text-xs"
      style={{ color: "var(--muted)" }}
    >
      {message}
    </div>
  );
}
