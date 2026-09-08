/**
 * The one on-chain action: a native COOK transfer with an optional memo.
 *
 * Deliberately the simplest meaningful transaction on Cookie Chain. It grants
 * no token allowances, deploys nothing, and touches only the system and memo
 * programs — so there is no approval the user could be tricked into leaving
 * open behind them. The wallet signs every transaction explicitly.
 */

import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { MEMO_PROGRAM_ID } from "./cookie-chain";

export type TxPhase =
  | "idle"
  | "awaiting-approval"
  | "pending"
  | "confirmed"
  | "failed";

export interface TxState {
  phase: TxPhase;
  signature: string | null;
  error: string | null;
  slot: number | null;
  confirmations: string | null;
}

export const INITIAL_TX_STATE: TxState = {
  phase: "idle",
  signature: null,
  error: null,
  slot: null,
  confirmations: null,
};

export interface ValidationResult {
  ok: boolean;
  error?: string;
  recipient?: PublicKey;
  lamports?: number;
}

/** Validate recipient + amount before a wallet prompt is ever raised. */
export function validateTransfer(
  recipientRaw: string,
  amountRaw: string,
  balanceCook: number,
  self: string | null,
): ValidationResult {
  const recipientText = recipientRaw.trim();
  if (!recipientText) return { ok: false, error: "Enter a recipient address." };

  let recipient: PublicKey;
  try {
    recipient = new PublicKey(recipientText);
    // A valid-length base58 string can still be off-curve; reject those early
    // so the failure is a clear message rather than an on-chain error.
    if (!PublicKey.isOnCurve(recipient.toBytes())) {
      return { ok: false, error: "That address is not a valid wallet address." };
    }
  } catch {
    return { ok: false, error: "That is not a valid Cookie Chain address." };
  }

  if (self && recipient.toBase58() === self) {
    return { ok: false, error: "Recipient cannot be your own address." };
  }

  const amount = Number(amountRaw);
  if (!amountRaw.trim() || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Enter an amount greater than zero." };
  }

  const lamports = Math.round(amount * LAMPORTS_PER_SOL);
  if (lamports <= 0) {
    return { ok: false, error: "Amount is smaller than the smallest unit of COOK." };
  }

  // Leave headroom for the fee so the transfer cannot fail for being 1 lamport over.
  const FEE_HEADROOM_COOK = 0.001;
  if (amount > Math.max(balanceCook - FEE_HEADROOM_COOK, 0)) {
    return {
      ok: false,
      error: `Amount exceeds your spendable balance (${Math.max(balanceCook - FEE_HEADROOM_COOK, 0).toFixed(4)} COOK after fee headroom).`,
    };
  }

  return { ok: true, recipient, lamports };
}

export function buildTransferTransaction(
  from: PublicKey,
  to: PublicKey,
  lamports: number,
  memo?: string,
): Transaction {
  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports }),
  );

  const trimmedMemo = memo?.trim();
  if (trimmedMemo) {
    tx.add(
      new TransactionInstruction({
        keys: [{ pubkey: from, isSigner: true, isWritable: false }],
        programId: new PublicKey(MEMO_PROGRAM_ID),
        data: Buffer.from(trimmedMemo, "utf8"),
      }),
    );
  }

  return tx;
}

/** Turn wallet/RPC exceptions into something a person can act on. */
export function humaniseTxError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (/user rejected|rejected the request|declined/i.test(message)) {
    return "You rejected the transaction in your wallet. Nothing was sent.";
  }
  if (/insufficient (lamports|funds)/i.test(message)) {
    return "Insufficient COOK to cover the transfer and its network fee.";
  }
  if (/blockhash not found|block height exceeded/i.test(message)) {
    return "The transaction expired before it was confirmed. Please try again.";
  }
  if (/already been processed/i.test(message)) {
    return "This transaction was already processed on Cookie Chain.";
  }
  if (/failed to fetch|network ?error|ECONNREFUSED/i.test(message)) {
    return "Could not reach the Cookie Chain RPC. Check your connection and try again.";
  }
  if (/wallet not connected/i.test(message)) {
    return "Your wallet disconnected. Reconnect Nightly and try again.";
  }
  return message;
}

/** Wait for confirmation using a blockhash-bounded strategy. */
export async function confirmTransfer(
  connection: Connection,
  signature: string,
  blockhash: string,
  lastValidBlockHeight: number,
): Promise<{ slot: number | null; err: unknown }> {
  const result = await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed",
  );
  return { slot: result.context.slot ?? null, err: result.value.err };
}
