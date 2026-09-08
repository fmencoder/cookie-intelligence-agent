"use client";

/** Send COOK — the app's single on-chain action, with full lifecycle feedback. */

import { useCallback, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@/components/ui/primitives";
import {
  buildTransferTransaction,
  confirmTransfer,
  humaniseTxError,
  INITIAL_TX_STATE,
  validateTransfer,
  type TxState,
} from "@/lib/send";
import { explorerTxUrl, formatAmount, shortAddress } from "@/lib/cookie-chain";

export function SendPanel({
  balanceCook,
  onConfirmed,
}: {
  balanceCook: number;
  onConfirmed: () => void;
}) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [tx, setTx] = useState<TxState>(INITIAL_TX_STATE);

  const busy = tx.phase === "awaiting-approval" || tx.phase === "pending";

  const handleSend = useCallback(async () => {
    if (!publicKey || !connected) return;

    const validation = validateTransfer(
      recipient,
      amount,
      balanceCook,
      publicKey.toBase58(),
    );
    if (!validation.ok || !validation.recipient || !validation.lamports) {
      setTx({ ...INITIAL_TX_STATE, phase: "failed", error: validation.error ?? "Invalid input." });
      return;
    }

    setTx({ ...INITIAL_TX_STATE, phase: "awaiting-approval" });

    try {
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");

      const transaction = buildTransferTransaction(
        publicKey,
        validation.recipient,
        validation.lamports,
        memo,
      );
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // The wallet raises its own approval prompt here — the app never holds a
      // key and cannot send anything the user has not explicitly signed.
      const signature = await sendTransaction(transaction, connection);

      setTx({
        phase: "pending",
        signature,
        error: null,
        slot: null,
        confirmations: "Submitted to Cookie Chain, waiting for confirmation…",
      });

      const { slot, err } = await confirmTransfer(
        connection,
        signature,
        blockhash,
        lastValidBlockHeight,
      );

      if (err) {
        setTx({
          phase: "failed",
          signature,
          error: `The transaction landed on-chain but failed: ${JSON.stringify(err)}`,
          slot,
          confirmations: null,
        });
        return;
      }

      setTx({
        phase: "confirmed",
        signature,
        error: null,
        slot,
        confirmations: "Confirmed",
      });
      setRecipient("");
      setAmount("");
      setMemo("");
      onConfirmed();
    } catch (error) {
      setTx({
        phase: "failed",
        signature: tx.signature,
        error: humaniseTxError(error),
        slot: null,
        confirmations: null,
      });
    }
  }, [
    amount,
    balanceCook,
    connected,
    connection,
    memo,
    onConfirmed,
    publicKey,
    recipient,
    sendTransaction,
    tx.signature,
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowUpRight className="h-4 w-4" style={{ color: "var(--accent)" }} />
          Send COOK
        </CardTitle>
        <CardDescription>
          A native transfer on Cookie Chain. Signed in your wallet — this app never
          holds a key and requests no token allowances.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <div>
          <label htmlFor="recipient" className="mb-1 block text-xs font-medium">
            Recipient address
          </label>
          <Input
            id="recipient"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Cookie Chain address"
            className="font-mono text-xs"
            disabled={busy}
            spellCheck={false}
            autoComplete="off"
          />
        </div>

        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <label htmlFor="amount" className="block text-xs font-medium">
              Amount (COOK)
            </label>
            <button
              type="button"
              className="text-[11px] underline"
              style={{ color: "var(--muted)" }}
              disabled={busy}
              onClick={() => setAmount(String(Math.max(balanceCook - 0.001, 0)))}
            >
              Max {formatAmount(Math.max(balanceCook - 0.001, 0))}
            </button>
          </div>
          <Input
            id="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            inputMode="decimal"
            disabled={busy}
          />
        </div>

        <div>
          <label htmlFor="memo" className="mb-1 block text-xs font-medium">
            Memo <span style={{ color: "var(--muted)" }}>(optional, on-chain)</span>
          </label>
          <Input
            id="memo"
            value={memo}
            onChange={(e) => setMemo(e.target.value.slice(0, 120))}
            placeholder="gm from Cookie Intelligence Agent"
            disabled={busy}
            maxLength={120}
          />
        </div>

        <Button onClick={() => void handleSend()} disabled={busy || !connected} className="w-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin-slow" /> : <ArrowUpRight className="h-4 w-4" />}
          {tx.phase === "awaiting-approval"
            ? "Approve in wallet…"
            : tx.phase === "pending"
              ? "Confirming…"
              : "Review & send"}
        </Button>

        <p
          className="flex items-start gap-1.5 text-[11px]"
          style={{ color: "var(--muted)" }}
        >
          <ShieldCheck className="mt-px h-3 w-3 shrink-0" />
          Every transaction requires explicit approval in Nightly. No seed phrase, private
          key, or token approval is ever requested.
        </p>

        <TxStatus tx={tx} />
      </CardContent>
    </Card>
  );
}

function TxStatus({ tx }: { tx: TxState }) {
  if (tx.phase === "idle") return null;

  const tone =
    tx.phase === "confirmed"
      ? "var(--pos)"
      : tx.phase === "failed"
        ? "var(--neg)"
        : "var(--accent)";

  const label =
    tx.phase === "confirmed"
      ? "CONFIRMED"
      : tx.phase === "failed"
        ? "FAILED"
        : "PENDING";

  return (
    <div
      className="rounded-lg border p-3 text-xs animate-rise"
      style={{ background: "var(--panel-alt)", borderColor: tone }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 font-semibold" style={{ color: tone }}>
        {tx.phase === "confirmed" ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : tx.phase === "failed" ? (
          <XCircle className="h-4 w-4" />
        ) : (
          <Loader2 className="h-4 w-4 animate-spin-slow" />
        )}
        {label}
        {tx.phase === "awaiting-approval" ? (
          <span className="font-normal" style={{ color: "var(--muted)" }}>
            — awaiting wallet approval
          </span>
        ) : null}
      </div>

      {tx.confirmations ? (
        <p className="mt-1.5" style={{ color: "var(--muted)" }}>
          {tx.confirmations}
          {tx.slot ? ` · slot ${tx.slot.toLocaleString()}` : ""}
        </p>
      ) : null}

      {tx.error ? (
        <p className="mt-1.5" style={{ color: "var(--neg)" }}>
          {tx.error}
        </p>
      ) : null}

      {tx.signature ? (
        <div className="mt-2 space-y-1">
          <div className="scroll-x">
            <code className="font-mono text-[11px]" style={{ color: "var(--muted)" }}>
              {shortAddress(tx.signature, 10, 10)}
            </code>
          </div>
          <a
            href={explorerTxUrl(tx.signature)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 underline"
            style={{ color: "var(--accent)" }}
          >
            View on CookieScan
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      ) : null}
    </div>
  );
}
