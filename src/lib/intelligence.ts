/**
 * Deterministic wallet intelligence.
 *
 * Every number the UI shows and every fact the AI panel is allowed to state is
 * produced here, from data that came off Cookie Chain. Nothing in this module
 * calls a model or a network — it is a pure function of a `WalletSnapshot`,
 * which is what makes the AI answers auditable and unit-testable.
 */

import type {
  AssetActivityStat,
  ConcentrationBucket,
  CounterpartyStat,
  WalletAnalysis,
  WalletSnapshot,
} from "./types";
import { formatAmount, formatPercent, shortAddress } from "./cookie-chain";

const DAY_SECONDS = 86_400;

/**
 * Herfindahl–Hirschman Index over portfolio weights.
 *
 * Returns 1.0 for a single-asset wallet and approaches 1/n for n equal
 * holdings, so it is a compact, monotonic measure of concentration risk.
 */
export function herfindahlIndex(weights: number[]): number {
  const total = weights.reduce((sum, w) => sum + Math.max(w, 0), 0);
  if (total <= 0) return 0;
  return weights.reduce((sum, w) => {
    const share = Math.max(w, 0) / total;
    return sum + share * share;
  }, 0);
}

export function labelConcentration(
  hhi: number,
  assetCount: number,
): WalletAnalysis["concentrationLabel"] {
  if (assetCount === 0) return "empty";
  if (assetCount === 1) return "single-asset";
  if (hhi >= 0.5) return "concentrated";
  if (hhi >= 0.25) return "balanced";
  return "diversified";
}

/**
 * Rank holdings by share of the portfolio.
 *
 * Note: Cookie Chain has no canonical price oracle wired into this app, so
 * shares are computed by *token quantity*, not USD value. That is stated
 * plainly in the UI rather than being papered over with invented prices.
 */
export function buildConcentration(
  snapshot: WalletSnapshot,
): ConcentrationBucket[] {
  const held = snapshot.holdings.filter((h) => h.amount > 0);
  const total = held.reduce((sum, h) => sum + h.amount, 0);
  if (total <= 0) return [];

  return held
    .map((h) => ({
      symbol: h.symbol,
      mint: h.mint,
      amount: h.amount,
      share: h.amount / total,
    }))
    .sort((a, b) => b.share - a.share);
}

function summariseCounterparties(
  snapshot: WalletSnapshot,
  limit = 5,
): CounterpartyStat[] {
  const byAddress = new Map<string, CounterpartyStat>();

  for (const tx of snapshot.transactions) {
    if (!tx.counterparty) continue;
    const existing = byAddress.get(tx.counterparty) ?? {
      address: tx.counterparty,
      interactions: 0,
      netCook: 0,
    };
    existing.interactions += 1;
    existing.netCook += tx.nativeChangeCook;
    byAddress.set(tx.counterparty, existing);
  }

  return [...byAddress.values()]
    .sort((a, b) => b.interactions - a.interactions)
    .slice(0, limit);
}

function summariseAssetActivity(
  snapshot: WalletSnapshot,
  limit = 5,
): AssetActivityStat[] {
  const symbolByMint = new Map(
    snapshot.holdings.map((h) => [h.mint, h.symbol] as const),
  );
  const counts = new Map<string, number>();

  for (const tx of snapshot.transactions) {
    // A transaction that moves native COOK counts as activity on COOK.
    const mints = tx.touchedMints.length
      ? tx.touchedMints
      : tx.nativeChangeCook !== 0 || tx.feeCook > 0
        ? ["native"]
        : [];
    for (const mint of mints) {
      counts.set(mint, (counts.get(mint) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([mint, touches]) => ({
      mint,
      symbol: symbolByMint.get(mint) ?? (mint === "native" ? "COOK" : shortAddress(mint)),
      touches,
    }))
    .sort((a, b) => b.touches - a.touches)
    .slice(0, limit);
}

function buildHighlights(analysis: Omit<WalletAnalysis, "highlights">): string[] {
  const out: string[] = [];

  if (analysis.assetCount === 0) {
    out.push("This wallet currently holds no assets on Cookie Chain.");
  } else if (analysis.largestPosition) {
    const { symbol, share } = analysis.largestPosition;
    out.push(
      `${symbol} is the largest position at ${formatPercent(share)} of holdings by token quantity.`,
    );
  }

  if (analysis.concentrationLabel === "concentrated") {
    out.push(
      `Holdings are concentrated (HHI ${analysis.hhi.toFixed(2)}) — most of the balance sits in one asset.`,
    );
  } else if (analysis.concentrationLabel === "diversified") {
    out.push(
      `Holdings are spread across ${analysis.assetCount} assets (HHI ${analysis.hhi.toFixed(2)}).`,
    );
  }

  if (analysis.txCount === 0) {
    out.push("No transactions were found in the sampled history window.");
  } else {
    out.push(
      `${analysis.txCount} recent transactions sampled, ${formatPercent(analysis.successRate, 0)} of which succeeded.`,
    );

    if (analysis.netFlowCook > 0) {
      out.push(
        `Net COOK flow over the sampled window is positive: +${formatAmount(analysis.netFlowCook)} COOK.`,
      );
    } else if (analysis.netFlowCook < 0) {
      out.push(
        `Net COOK flow over the sampled window is negative: ${formatAmount(analysis.netFlowCook)} COOK.`,
      );
    }

    if (analysis.txLast24h > 0) {
      out.push(`${analysis.txLast24h} of those landed in the last 24 hours.`);
    }
  }

  if (analysis.failedTxCount > 0) {
    out.push(
      `${analysis.failedTxCount} sampled transaction${analysis.failedTxCount === 1 ? "" : "s"} failed on-chain.`,
    );
  }

  return out;
}

/** Turn a raw on-chain snapshot into the full analysis the app reasons about. */
export function analyseWallet(snapshot: WalletSnapshot): WalletAnalysis {
  const concentration = buildConcentration(snapshot);
  const hhi = herfindahlIndex(concentration.map((c) => c.amount));
  const assetCount = concentration.length;

  const txs = snapshot.transactions;
  const failedTxCount = txs.filter((t) => t.failed).length;

  let inflowCook = 0;
  let outflowCook = 0;
  let feesPaidCook = 0;

  for (const tx of txs) {
    if (tx.nativeChangeCook > 0) inflowCook += tx.nativeChangeCook;
    if (tx.nativeChangeCook < 0) outflowCook += Math.abs(tx.nativeChangeCook);
    feesPaidCook += tx.feeCook;
  }

  const times = txs
    .map((t) => t.blockTime)
    .filter((t): t is number => typeof t === "number" && t > 0);

  const lastActive = times.length ? Math.max(...times) : null;
  const firstSeen = times.length ? Math.min(...times) : null;

  // Windows are measured from the most recent sampled transaction rather than
  // wall-clock "now", so the counts stay meaningful for dormant wallets.
  const anchor = lastActive ?? 0;
  const txLast24h = times.filter((t) => anchor - t <= DAY_SECONDS).length;
  const txLast7d = times.filter((t) => anchor - t <= 7 * DAY_SECONDS).length;

  const base: Omit<WalletAnalysis, "highlights"> = {
    address: snapshot.address,
    assetCount,
    nativeBalanceCook: snapshot.nativeBalanceCook,
    concentration,
    hhi,
    concentrationLabel: labelConcentration(hhi, assetCount),
    largestPosition: concentration[0] ?? null,
    txCount: txs.length,
    failedTxCount,
    successRate: txs.length ? (txs.length - failedTxCount) / txs.length : 1,
    inflowCook,
    outflowCook,
    netFlowCook: inflowCook - outflowCook,
    feesPaidCook,
    firstSeen,
    lastActive,
    txLast24h,
    txLast7d,
    topCounterparties: summariseCounterparties(snapshot),
    mostActiveAssets: summariseAssetActivity(snapshot),
  };

  return { ...base, highlights: buildHighlights(base) };
}

/**
 * The compact, machine-readable fact sheet handed to the language model.
 *
 * The model is shown *only* this. It has no network access and no chain
 * access, so any figure it states must have come from here — which is exactly
 * the property that stops it inventing balances.
 */
export function buildFactSheet(
  snapshot: WalletSnapshot,
  analysis: WalletAnalysis,
): string {
  const lines: string[] = [];

  lines.push(`WALLET: ${snapshot.address}`);
  lines.push(`NETWORK: Cookie Chain (SVM Layer 1), native token COOK`);
  lines.push(`SNAPSHOT_TAKEN: ${new Date(snapshot.fetchedAt).toISOString()}`);

  if (snapshot.vitals) {
    lines.push(
      `CHAIN: slot=${snapshot.vitals.slot} epoch=${snapshot.vitals.epoch} health=${
        snapshot.vitals.healthy ? "ok" : "degraded"
      } rpc_latency_ms=${snapshot.vitals.latencyMs}`,
    );
  }

  lines.push("");
  lines.push(`NATIVE_BALANCE_COOK: ${snapshot.nativeBalanceCook}`);
  lines.push(`DISTINCT_ASSETS_HELD: ${analysis.assetCount}`);
  lines.push("");

  lines.push("HOLDINGS (symbol | mint | amount | share_of_portfolio_by_quantity):");
  if (analysis.concentration.length === 0) {
    lines.push("  (none)");
  } else {
    for (const bucket of analysis.concentration) {
      lines.push(
        `  ${bucket.symbol} | ${bucket.mint} | ${bucket.amount} | ${formatPercent(bucket.share)}`,
      );
    }
  }

  lines.push("");
  lines.push(
    `CONCENTRATION: hhi=${analysis.hhi.toFixed(4)} label=${analysis.concentrationLabel}`,
  );
  lines.push(
    `NOTE: shares are by token QUANTITY, not USD value — this app has no price oracle. Never state a USD figure.`,
  );

  lines.push("");
  lines.push(
    `ACTIVITY: sampled_tx=${analysis.txCount} failed=${analysis.failedTxCount} success_rate=${formatPercent(
      analysis.successRate,
      0,
    )} tx_last_24h=${analysis.txLast24h} tx_last_7d=${analysis.txLast7d}`,
  );
  lines.push(
    `FLOWS_COOK: in=${analysis.inflowCook} out=${analysis.outflowCook} net=${analysis.netFlowCook} fees_paid=${analysis.feesPaidCook}`,
  );
  lines.push(
    `LAST_ACTIVE: ${analysis.lastActive ? new Date(analysis.lastActive * 1000).toISOString() : "unknown"}`,
  );

  lines.push("");
  lines.push("MOST_ACTIVE_ASSETS (symbol | transactions_touching_it):");
  if (analysis.mostActiveAssets.length === 0) {
    lines.push("  (none)");
  } else {
    for (const a of analysis.mostActiveAssets) {
      lines.push(`  ${a.symbol} | ${a.touches}`);
    }
  }

  lines.push("");
  lines.push("TOP_COUNTERPARTIES (address | interactions | net_cook):");
  if (analysis.topCounterparties.length === 0) {
    lines.push("  (none)");
  } else {
    for (const c of analysis.topCounterparties) {
      lines.push(`  ${c.address} | ${c.interactions} | ${c.netCook}`);
    }
  }

  lines.push("");
  lines.push(
    "RECENT_TRANSACTIONS (signature | time | status | direction | native_cook_change | fee_cook | counterparty):",
  );
  if (snapshot.transactions.length === 0) {
    lines.push("  (none)");
  } else {
    for (const tx of snapshot.transactions.slice(0, 25)) {
      lines.push(
        `  ${tx.signature} | ${
          tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : "unknown"
        } | ${tx.failed ? "FAILED" : "SUCCESS"} | ${tx.direction} | ${tx.nativeChangeCook} | ${tx.feeCook} | ${
          tx.counterparty ?? "n/a"
        }`,
      );
    }
  }

  if (snapshot.warnings.length) {
    lines.push("");
    lines.push("DATA_GAPS (be transparent about these if relevant):");
    for (const w of snapshot.warnings) lines.push(`  - ${w}`);
  }

  return lines.join("\n");
}
