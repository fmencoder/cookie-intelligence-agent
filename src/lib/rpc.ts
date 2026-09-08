/**
 * Cookie Chain data access.
 *
 * All of these run in the browser and talk straight to the Cookie Chain RPC.
 * Keeping the read path client-side means the deployment needs no server-side
 * chain credentials, and the data the user sees is provably the data the node
 * returned — there is no backend in the middle that could reshape it.
 */

import {
  Connection,
  LAMPORTS_PER_SOL,
  ParsedTransactionWithMeta,
  PublicKey,
} from "@solana/web3.js";
import { COOKIE_DAS_URL, MEMO_PROGRAM_ID } from "./cookie-chain";
import type {
  ChainVitals,
  TokenHolding,
  TxDirection,
  WalletSnapshot,
  WalletTransaction,
} from "./types";

/** SVM token programs. Cookie Chain deploys both at the canonical addresses. */
const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);
const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
);

/** How many recent signatures to sample when profiling a wallet. */
export const HISTORY_LIMIT = 40;

export async function fetchChainVitals(
  connection: Connection,
): Promise<ChainVitals> {
  const startedAt = performance.now();

  // getHealth is not exposed by web3.js, and some nodes disable it, so it is
  // probed directly and treated as advisory rather than authoritative.
  const [epochInfo, version, genesisHash, health] = await Promise.all([
    connection.getEpochInfo(),
    connection.getVersion().catch(() => null),
    connection.getGenesisHash().catch(() => null),
    rawRpc<string>(connection.rpcEndpoint, "getHealth", []).catch(() => null),
  ]);

  return {
    healthy: health === "ok" || health === null,
    slot: epochInfo.absoluteSlot,
    blockHeight: epochInfo.blockHeight ?? null,
    epoch: epochInfo.epoch,
    slotIndex: epochInfo.slotIndex,
    slotsInEpoch: epochInfo.slotsInEpoch,
    version: version?.["solana-core"] ?? null,
    latencyMs: Math.round(performance.now() - startedAt),
    genesisHash,
  };
}

/** Minimal JSON-RPC escape hatch for methods web3.js does not wrap. */
async function rawRpc<T>(
  endpoint: string,
  method: string,
  params: unknown[],
): Promise<T> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) {
    throw new Error(`${method} failed: HTTP ${response.status}`);
  }
  const json = await response.json();
  if (json.error) {
    throw new Error(`${method} failed: ${json.error.message ?? "rpc error"}`);
  }
  return json.result as T;
}

/**
 * Enrich SPL mints with names/symbols via the Cookie DAS API.
 *
 * This is strictly a nice-to-have: if the DAS endpoint is unavailable the
 * dashboard still renders every holding, just labelled by mint address.
 */
async function fetchDasMetadata(
  owner: string,
): Promise<Map<string, { symbol?: string; name?: string }>> {
  const out = new Map<string, { symbol?: string; name?: string }>();

  const response = await fetch(COOKIE_DAS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "cookie-intelligence",
      method: "getAssetsByOwner",
      params: { ownerAddress: owner, page: 1, limit: 200 },
    }),
  });

  if (!response.ok) throw new Error(`DAS HTTP ${response.status}`);
  const json = await response.json();
  if (json.error) throw new Error(json.error.message ?? "DAS error");

  const items: unknown[] = json.result?.items ?? [];
  for (const raw of items) {
    const item = raw as {
      id?: string;
      content?: { metadata?: { symbol?: string; name?: string } };
      token_info?: { symbol?: string };
    };
    if (!item.id) continue;
    const symbol = item.token_info?.symbol ?? item.content?.metadata?.symbol;
    const name = item.content?.metadata?.name;
    if (symbol || name) out.set(item.id, { symbol, name });
  }

  return out;
}

export async function fetchHoldings(
  connection: Connection,
  owner: PublicKey,
): Promise<{ holdings: TokenHolding[]; warnings: string[] }> {
  const warnings: string[] = [];

  const [lamports, legacy, token2022] = await Promise.all([
    connection.getBalance(owner),
    connection.getParsedTokenAccountsByOwner(owner, {
      programId: TOKEN_PROGRAM_ID,
    }),
    connection
      .getParsedTokenAccountsByOwner(owner, { programId: TOKEN_2022_PROGRAM_ID })
      .catch(() => ({ value: [] as never[] })),
  ]);

  const holdings: TokenHolding[] = [
    {
      mint: "native",
      symbol: "COOK",
      name: "Cookie Chain",
      amount: lamports / LAMPORTS_PER_SOL,
      decimals: 9,
      rawAmount: String(lamports),
      isNative: true,
    },
  ];

  // Multiple token accounts can share a mint, so balances are summed per mint.
  const byMint = new Map<string, TokenHolding>();

  for (const [programId, accounts] of [
    [TOKEN_PROGRAM_ID.toBase58(), legacy.value],
    [TOKEN_2022_PROGRAM_ID.toBase58(), token2022.value],
  ] as const) {
    for (const { account } of accounts) {
      const info = (
        account.data as unknown as {
          parsed?: {
            info?: {
              mint?: string;
              tokenAmount?: {
                amount?: string;
                decimals?: number;
                uiAmount?: number | null;
              };
            };
          };
        }
      ).parsed?.info;

      const mint = info?.mint;
      const tokenAmount = info?.tokenAmount;
      if (!mint || !tokenAmount) continue;

      const amount = tokenAmount.uiAmount ?? 0;
      // Zero-balance accounts are noise on a dashboard; drop them.
      if (amount <= 0) continue;

      const existing = byMint.get(mint);
      if (existing) {
        existing.amount += amount;
        existing.rawAmount = String(
          BigInt(existing.rawAmount) + BigInt(tokenAmount.amount ?? "0"),
        );
      } else {
        byMint.set(mint, {
          mint,
          symbol: `${mint.slice(0, 4)}…${mint.slice(-4)}`,
          name: "Unknown SPL token",
          amount,
          decimals: tokenAmount.decimals ?? 0,
          rawAmount: tokenAmount.amount ?? "0",
          isNative: false,
          programId,
        });
      }
    }
  }

  if (byMint.size > 0) {
    try {
      const metadata = await fetchDasMetadata(owner.toBase58());
      for (const [mint, holding] of byMint) {
        const meta = metadata.get(mint);
        if (meta?.symbol) holding.symbol = meta.symbol;
        if (meta?.name) holding.name = meta.name;
      }
    } catch {
      warnings.push(
        "Cookie DAS API was unreachable — SPL tokens are labelled by mint address instead of name.",
      );
    }
  }

  holdings.push(...[...byMint.values()].sort((a, b) => b.amount - a.amount));
  return { holdings, warnings };
}

function extractMemo(tx: ParsedTransactionWithMeta): string | null {
  for (const log of tx.meta?.logMessages ?? []) {
    // Memo program logs its payload as: Program log: Memo (len 5): "hello"
    const match = log.match(/Program log: Memo \(len \d+\): "(.*)"$/);
    if (match) return match[1];
  }
  return null;
}

/** Reduce a parsed transaction to the facts that matter for one wallet. */
export function summariseTransaction(
  tx: ParsedTransactionWithMeta,
  signature: string,
  owner: string,
): WalletTransaction {
  const accountKeys = tx.transaction.message.accountKeys.map((k) =>
    k.pubkey.toBase58(),
  );
  const ownerIndex = accountKeys.indexOf(owner);

  const pre = tx.meta?.preBalances ?? [];
  const post = tx.meta?.postBalances ?? [];

  const nativeChangeLamports =
    ownerIndex >= 0 && pre[ownerIndex] !== undefined && post[ownerIndex] !== undefined
      ? post[ownerIndex] - pre[ownerIndex]
      : 0;

  const feeLamports = tx.meta?.fee ?? 0;
  // The fee payer's balance delta includes the fee; the economic direction of
  // the transfer is clearer once the fee is added back.
  const isFeePayer = ownerIndex === 0;
  const economicChange = isFeePayer
    ? nativeChangeLamports + feeLamports
    : nativeChangeLamports;

  let direction: TxDirection = "other";
  if (economicChange > 0) direction = "in";
  else if (economicChange < 0) direction = "out";
  else if (ownerIndex >= 0) direction = "self";

  // Best-effort counterparty: the other side of the largest opposing balance move.
  let counterparty: string | null = null;
  let bestDelta = 0;
  for (let i = 0; i < accountKeys.length; i += 1) {
    if (i === ownerIndex) continue;
    if (pre[i] === undefined || post[i] === undefined) continue;
    const delta = post[i] - pre[i];
    // Opposing sign to our own move, and materially large.
    if (Math.sign(delta) === -Math.sign(economicChange) && Math.abs(delta) > Math.abs(bestDelta)) {
      bestDelta = delta;
      counterparty = accountKeys[i];
    }
  }

  const touchedMints = new Set<string>();
  for (const balance of [
    ...(tx.meta?.preTokenBalances ?? []),
    ...(tx.meta?.postTokenBalances ?? []),
  ]) {
    if (balance.owner === owner && balance.mint) touchedMints.add(balance.mint);
  }

  const programIds = new Set<string>();
  for (const ix of tx.transaction.message.instructions) {
    programIds.add(ix.programId.toBase58());
  }

  return {
    signature,
    blockTime: tx.blockTime ?? null,
    slot: tx.slot,
    failed: Boolean(tx.meta?.err),
    err: tx.meta?.err ? JSON.stringify(tx.meta.err) : null,
    feeCook: feeLamports / LAMPORTS_PER_SOL,
    nativeChangeCook: economicChange / LAMPORTS_PER_SOL,
    direction,
    counterparty,
    touchedMints: [...touchedMints],
    programIds: [...programIds],
    memo: extractMemo(tx),
  };
}

export async function fetchTransactions(
  connection: Connection,
  owner: PublicKey,
  limit = HISTORY_LIMIT,
): Promise<{ transactions: WalletTransaction[]; warnings: string[] }> {
  const warnings: string[] = [];
  const signatures = await connection.getSignaturesForAddress(owner, { limit });
  if (signatures.length === 0) return { transactions: [], warnings };

  const ownerKey = owner.toBase58();
  const transactions: WalletTransaction[] = [];

  // Nodes cap batch sizes, so parsed transactions are pulled in chunks.
  const CHUNK = 10;
  for (let i = 0; i < signatures.length; i += CHUNK) {
    const chunk = signatures.slice(i, i + CHUNK);
    let parsed: (ParsedTransactionWithMeta | null)[];
    try {
      parsed = await connection.getParsedTransactions(
        chunk.map((s) => s.signature),
        { maxSupportedTransactionVersion: 0 },
      );
    } catch {
      warnings.push(
        "Some transaction details could not be loaded from the Cookie Chain RPC.",
      );
      continue;
    }

    parsed.forEach((tx, index) => {
      const meta = chunk[index];
      if (!tx) {
        // Signature is real but the payload was unavailable — record it
        // honestly rather than silently dropping it from the count.
        transactions.push({
          signature: meta.signature,
          blockTime: meta.blockTime ?? null,
          slot: meta.slot,
          failed: Boolean(meta.err),
          err: meta.err ? JSON.stringify(meta.err) : null,
          feeCook: 0,
          nativeChangeCook: 0,
          direction: "other",
          counterparty: null,
          touchedMints: [],
          programIds: [],
          memo: null,
        });
        return;
      }
      transactions.push(summariseTransaction(tx, meta.signature, ownerKey));
    });
  }

  transactions.sort((a, b) => (b.blockTime ?? 0) - (a.blockTime ?? 0));
  return { transactions, warnings };
}

/** Build the complete wallet snapshot the whole app reasons about. */
export async function fetchWalletSnapshot(
  connection: Connection,
  owner: PublicKey,
): Promise<WalletSnapshot> {
  const warnings: string[] = [];

  const [vitals, holdingsResult, txResult] = await Promise.all([
    fetchChainVitals(connection).catch(() => {
      warnings.push("Chain vitals could not be read from the Cookie Chain RPC.");
      return null;
    }),
    fetchHoldings(connection, owner),
    fetchTransactions(connection, owner),
  ]);

  warnings.push(...holdingsResult.warnings, ...txResult.warnings);

  return {
    address: owner.toBase58(),
    fetchedAt: Date.now(),
    nativeBalanceCook: holdingsResult.holdings[0]?.amount ?? 0,
    holdings: holdingsResult.holdings,
    transactions: txResult.transactions,
    vitals,
    warnings: [...new Set(warnings)],
  };
}

export { MEMO_PROGRAM_ID };
