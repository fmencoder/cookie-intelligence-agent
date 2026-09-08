/**
 * Deterministic analyst.
 *
 * Answers the dashboard's supported questions with no model in the loop. It
 * runs whenever no ANTHROPIC_API_KEY is configured, and it is also the reason
 * the product degrades gracefully instead of going dark: every question the UI
 * suggests has a real, grounded answer either way.
 */

import { formatAmount, formatPercent, shortAddress } from "./cookie-chain";
import type { WalletAnalysis } from "./types";

export type Intent =
  | "summary"
  | "changes"
  | "positions"
  | "activity"
  | "transactions"
  | "unknown";

export function classifyIntent(question: string): Intent {
  const q = question.toLowerCase();

  if (/(recent|latest|last|show).*(transaction|tx|transfer)|^transactions?\b/.test(q)) {
    return "transactions";
  }
  if (/chang|recent|happen|new|updat|since/.test(q)) return "changes";
  if (/larg|big|top|position|holding|concentrat|expos/.test(q)) return "positions";
  if (/activ|busy|most used|frequen/.test(q)) return "activity";
  if (/summar|overview|tell me about|what.*wallet|explain/.test(q)) return "summary";
  return "unknown";
}

const COOK = (n: number) => `${formatAmount(n)} COOK`;

export function answerDeterministically(
  question: string,
  analysis: WalletAnalysis,
): string {
  const intent = classifyIntent(question);

  switch (intent) {
    case "summary": {
      const parts = [
        `This wallet holds ${COOK(analysis.nativeBalanceCook)} natively across ${analysis.assetCount} distinct asset${analysis.assetCount === 1 ? "" : "s"} on Cookie Chain.`,
      ];
      if (analysis.largestPosition) {
        parts.push(
          `Its largest position is ${analysis.largestPosition.symbol} at ${formatPercent(analysis.largestPosition.share)} of holdings by token quantity, giving a ${analysis.concentrationLabel} portfolio (HHI ${analysis.hhi.toFixed(2)}).`,
        );
      }
      parts.push(
        `Across the ${analysis.txCount} most recent transaction${analysis.txCount === 1 ? "" : "s"}, ${formatPercent(analysis.successRate, 0)} succeeded, net native flow was ${analysis.netFlowCook >= 0 ? "+" : ""}${COOK(analysis.netFlowCook)}, and ${formatAmount(analysis.feesPaidCook, 6)} COOK went to fees.`,
      );
      return parts.join(" ");
    }

    case "changes": {
      if (analysis.txCount === 0) {
        return "No transactions were found in the sampled history window, so there is nothing recent to report for this wallet.";
      }
      const parts = [
        `In the sampled window this wallet recorded ${analysis.txCount} transactions — ${analysis.txLast24h} within 24 hours of its most recent activity and ${analysis.txLast7d} within 7 days.`,
        `Native COOK moved ${COOK(analysis.inflowCook)} in and ${COOK(analysis.outflowCook)} out, a net of ${analysis.netFlowCook >= 0 ? "+" : ""}${COOK(analysis.netFlowCook)}.`,
      ];
      if (analysis.failedTxCount > 0) {
        parts.push(`${analysis.failedTxCount} of those transactions failed on-chain.`);
      }
      if (analysis.mostActiveAssets[0]) {
        parts.push(
          `The most frequently touched asset was ${analysis.mostActiveAssets[0].symbol}, appearing in ${analysis.mostActiveAssets[0].touches} transactions.`,
        );
      }
      return parts.join(" ");
    }

    case "positions": {
      if (analysis.concentration.length === 0) {
        return "This wallet currently holds no assets with a non-zero balance on Cookie Chain.";
      }
      const top = analysis.concentration.slice(0, 5);
      const list = top
        .map(
          (b, i) =>
            `${i + 1}. ${b.symbol} — ${formatAmount(b.amount)} (${formatPercent(b.share)} of holdings)`,
        )
        .join("\n");
      return `Largest positions by token quantity:\n\n${list}\n\nConcentration is ${analysis.concentrationLabel} with an HHI of ${analysis.hhi.toFixed(2)}. Note that shares are by token quantity — this app does not use a price oracle, so these are not USD weights.`;
    }

    case "activity": {
      if (analysis.mostActiveAssets.length === 0) {
        return "No asset activity was observed in the sampled transaction window.";
      }
      const list = analysis.mostActiveAssets
        .map((a, i) => `${i + 1}. ${a.symbol} — touched by ${a.touches} transaction${a.touches === 1 ? "" : "s"}`)
        .join("\n");
      const counterparty = analysis.topCounterparties[0];
      const tail = counterparty
        ? `\n\nThe most frequent counterparty was ${shortAddress(counterparty.address, 6, 6)} across ${counterparty.interactions} interaction${counterparty.interactions === 1 ? "" : "s"}.`
        : "";
      return `Most active assets in the sampled window:\n\n${list}${tail}`;
    }

    case "transactions": {
      if (analysis.txCount === 0) {
        return "No transactions were found for this wallet in the sampled history window.";
      }
      return `The wallet has ${analysis.txCount} transactions in the sampled window (${analysis.failedTxCount} failed). They are listed in full, with signatures and CookieScan links, in the Recent Activity panel — each row links to the transaction on CookieScan so you can verify it independently.`;
    }

    default:
      return [
        "I can answer questions grounded in this wallet's live Cookie Chain data — its balances, holdings, concentration, recent activity and transactions.",
        "",
        "Try: “Summarize my wallet”, “What changed recently?”, “What are my largest positions?”, “Which assets are most active?” or “Show recent transactions”.",
      ].join("\n");
  }
}
