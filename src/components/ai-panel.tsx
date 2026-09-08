"use client";

/** Ask-anything panel, grounded in the fetched snapshot. */

import { useCallback, useRef, useState } from "react";
import { Loader2, Send, Sparkles, ShieldCheck } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@/components/ui/primitives";
import type { WalletSnapshot } from "@/lib/types";

const SUGGESTIONS = [
  "Summarize my wallet",
  "What changed recently?",
  "What are my largest positions?",
  "Which assets are most active?",
  "Show recent transactions",
];

interface Turn {
  question: string;
  answer: string;
  mode: string;
}

export function AiPanel({ snapshot }: { snapshot: WalletSnapshot | null }) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const ask = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !snapshot || loading) return;

      setLoading(true);
      setError(null);
      setQuestion("");

      try {
        const response = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: trimmed, snapshot }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? `Request failed (${response.status})`);
        }

        setTurns((prev) => [
          ...prev,
          { question: trimmed, answer: data.answer, mode: data.mode },
        ]);
        requestAnimationFrame(() =>
          endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    },
    [loading, snapshot],
  );

  const disabled = !snapshot || loading;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: "var(--accent)" }} />
          Intelligence
        </CardTitle>
        <CardDescription>
          Ask about this wallet. Every answer is grounded in the live Cookie Chain data
          shown on this page.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1" style={{ maxHeight: "22rem" }}>
          {turns.length === 0 ? (
            <div
              className="rounded-lg border border-dashed p-4 text-xs"
              style={{ color: "var(--muted)" }}
            >
              {snapshot
                ? "Pick a question below, or ask your own."
                : "Connect your wallet to start asking questions."}
            </div>
          ) : (
            turns.map((turn, i) => (
              <div key={i} className="space-y-1.5 animate-rise">
                <div className="text-xs font-semibold">{turn.question}</div>
                <div
                  className="whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-relaxed"
                  style={{ background: "var(--panel-alt)" }}
                >
                  {turn.answer}
                </div>
                <Badge tone={turn.mode === "ai" ? "accent" : "neutral"}>
                  {turn.mode === "ai"
                    ? "AI narration over verified chain data"
                    : turn.mode === "deterministic-fallback"
                      ? "Deterministic analyst (AI unavailable)"
                      : "Deterministic analyst"}
                </Badge>
              </div>
            ))
          )}
          {loading ? (
            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
              <Loader2 className="h-3.5 w-3.5 animate-spin-slow" />
              Analysing on-chain data…
            </div>
          ) : null}
          <div ref={endRef} />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => void ask(s)}
              disabled={disabled}
              className="rounded-full border px-2.5 py-1 text-[11px] transition-colors hover:bg-[var(--accent-soft)] disabled:opacity-40"
              style={{ color: "var(--muted)" }}
            >
              {s}
            </button>
          ))}
        </div>

        {error ? (
          <p className="text-xs" style={{ color: "var(--neg)" }} role="alert">
            {error}
          </p>
        ) : null}

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(question);
          }}
        >
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={snapshot ? "Ask about this wallet…" : "Connect a wallet first"}
            disabled={disabled}
            aria-label="Ask a question about this wallet"
            maxLength={500}
          />
          <Button type="submit" disabled={disabled || !question.trim()} aria-label="Send question">
            <Send className="h-4 w-4" />
          </Button>
        </form>

        <p className="flex items-start gap-1.5 text-[11px]" style={{ color: "var(--muted)" }}>
          <ShieldCheck className="mt-px h-3 w-3 shrink-0" />
          The model receives only the computed fact sheet from this wallet&apos;s chain
          data — it has no chain access and cannot invent balances. No price oracle is
          used, so no USD values are reported.
        </p>
      </CardContent>
    </Card>
  );
}
