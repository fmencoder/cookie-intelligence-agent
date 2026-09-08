/**
 * Cookie Chain network constants.
 *
 * Cookie Chain is a community-operated SVM Layer 1. Because it speaks the
 * standard Solana JSON-RPC dialect, the whole Solana toolchain (web3.js,
 * wallet-adapter, SPL programs, the Metaplex DAS API) works unchanged — we
 * simply point it at Cookie Chain infrastructure instead of Solana's.
 *
 * Every endpoint is overridable via env so the app can be pointed at a private
 * or self-hosted Cookie Chain node without a code change.
 */

export const COOKIE_RPC_URL =
  process.env.NEXT_PUBLIC_COOKIE_RPC_URL ?? "https://rpc.cookiescan.io";

export const COOKIE_WSS_URL =
  process.env.NEXT_PUBLIC_COOKIE_WSS_URL ?? "wss://wss.cookiescan.io";

/** Cookie DAS API — Metaplex Digital Asset Standard, used for token metadata. */
export const COOKIE_DAS_URL =
  process.env.NEXT_PUBLIC_COOKIE_DAS_URL ?? "https://api.cookiescan.io";

/** CookieScan — the canonical Cookie Chain block explorer. */
export const COOKIE_EXPLORER_URL =
  process.env.NEXT_PUBLIC_COOKIE_EXPLORER_URL ?? "https://cookiescan.io";

export const COOKIE_DOCS_URL = "https://docs.cookiechain.wtf";

/** Native gas token of Cookie Chain. */
export const NATIVE_SYMBOL = "COOK";

/** Cookie Chain uses the SVM standard of 9 decimals for its native token. */
export const NATIVE_DECIMALS = 9;
export const LAMPORTS_PER_COOK = 1_000_000_000;

/** SPL Memo program — deployed at the canonical SVM address on Cookie Chain. */
export const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

export function explorerAddressUrl(address: string): string {
  return `${COOKIE_EXPLORER_URL}/address/${address}`;
}

export function explorerTxUrl(signature: string): string {
  return `${COOKIE_EXPLORER_URL}/tx/${signature}`;
}

/** Truncate a base58 address for display: `9xQe…4Tg1`. */
export function shortAddress(value: string, left = 4, right = 4): string {
  if (!value) return "";
  if (value.length <= left + right + 1) return value;
  return `${value.slice(0, left)}…${value.slice(-right)}`;
}

/** Convert a raw base-unit amount into a human float, honouring decimals. */
export function toUiAmount(raw: number | bigint, decimals: number): number {
  return Number(raw) / 10 ** decimals;
}

export function formatAmount(value: number, maxDigits = 4): string {
  if (!Number.isFinite(value)) return "—";
  // `10 ** -n` is not exact in IEEE-754 (10 ** -4 === 0.00009999999999999999),
  // so the threshold is built by division and rendered with toFixed.
  const smallest = 1 / 10 ** maxDigits;
  if (value !== 0 && Math.abs(value) < smallest) {
    return `${value < 0 ? "-" : ""}<${smallest.toFixed(maxDigits)}`;
  }
  return value.toLocaleString("en-US", {
    maximumFractionDigits: maxDigits,
    minimumFractionDigits: 0,
  });
}

export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(fraction: number, digits = 1): string {
  if (!Number.isFinite(fraction)) return "—";
  return `${(fraction * 100).toFixed(digits)}%`;
}

/** Relative time formatter for block timestamps ("4m ago"). */
export function formatRelativeTime(
  unixSeconds: number | null | undefined,
  now = Date.now(),
): string {
  if (!unixSeconds) return "unknown time";
  const deltaSeconds = Math.round(now / 1000 - unixSeconds);
  if (deltaSeconds < 0) return "just now";
  if (deltaSeconds < 60) return `${deltaSeconds}s ago`;
  const minutes = Math.floor(deltaSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}
