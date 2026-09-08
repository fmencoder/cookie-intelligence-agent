/** Shared domain types for Cookie Chain wallet intelligence. */

export interface TokenHolding {
  /** SPL mint address, or the literal "native" for COOK. */
  mint: string;
  symbol: string;
  name: string;
  /** Human-readable amount (already divided by decimals). */
  amount: number;
  decimals: number;
  /** Raw base-unit amount, kept for exact arithmetic. */
  rawAmount: string;
  isNative: boolean;
  /** Owning token program — helps distinguish Token-2022 assets. */
  programId?: string;
}

export type TxDirection = "in" | "out" | "self" | "other";

export interface WalletTransaction {
  signature: string;
  /** Block time in unix seconds; null when the node has pruned it. */
  blockTime: number | null;
  slot: number;
  /** true when the transaction landed with an on-chain error. */
  failed: boolean;
  err: string | null;
  /** Fee paid, in COOK. */
  feeCook: number;
  /** Net change in native COOK for the inspected wallet (signed). */
  nativeChangeCook: number;
  direction: TxDirection;
  /** Best-effort counterparty address for a simple transfer. */
  counterparty: string | null;
  /** Mints whose balances moved for this wallet in this transaction. */
  touchedMints: string[];
  /** Program ids invoked, used to label the activity. */
  programIds: string[];
  memo: string | null;
}

export interface ChainVitals {
  healthy: boolean;
  slot: number;
  blockHeight: number | null;
  epoch: number;
  slotIndex: number;
  slotsInEpoch: number;
  version: string | null;
  /** Round-trip latency of the vitals probe, in milliseconds. */
  latencyMs: number;
  genesisHash: string | null;
}

/** Everything the UI and the AI layer are allowed to reason about. */
export interface WalletSnapshot {
  address: string;
  fetchedAt: number;
  nativeBalanceCook: number;
  holdings: TokenHolding[];
  transactions: WalletTransaction[];
  vitals: ChainVitals | null;
  /** Non-fatal degradations, surfaced honestly in the UI. */
  warnings: string[];
}

export interface ConcentrationBucket {
  symbol: string;
  mint: string;
  amount: number;
  /** Share of the portfolio by holding weight, 0..1. */
  share: number;
}

export interface CounterpartyStat {
  address: string;
  interactions: number;
  netCook: number;
}

export interface AssetActivityStat {
  mint: string;
  symbol: string;
  touches: number;
}

export interface WalletAnalysis {
  address: string;
  /** Number of distinct assets held with a non-zero balance. */
  assetCount: number;
  nativeBalanceCook: number;
  concentration: ConcentrationBucket[];
  /** Herfindahl–Hirschman Index over holding weights, 0..1. */
  hhi: number;
  concentrationLabel: "empty" | "single-asset" | "concentrated" | "balanced" | "diversified";
  largestPosition: ConcentrationBucket | null;
  txCount: number;
  failedTxCount: number;
  successRate: number;
  inflowCook: number;
  outflowCook: number;
  netFlowCook: number;
  feesPaidCook: number;
  firstSeen: number | null;
  lastActive: number | null;
  /** Transactions in the trailing 24h / 7d of the sampled window. */
  txLast24h: number;
  txLast7d: number;
  topCounterparties: CounterpartyStat[];
  mostActiveAssets: AssetActivityStat[];
  /** Short, plain-language observations derived purely from the numbers. */
  highlights: string[];
}
