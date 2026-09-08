/**
 * AI narration endpoint.
 *
 * Grounding contract: this route never touches the chain. The client sends the
 * snapshot it already fetched and rendered, the server recomputes the analysis
 * deterministically, and the model is handed *only* that fact sheet. Any figure
 * in the answer therefore traces back to data the user can see on screen and
 * verify on CookieScan.
 *
 * With no ANTHROPIC_API_KEY configured the route still answers, using the
 * deterministic analyst, so the product never depends on a key to be useful.
 */

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { analyseWallet, buildFactSheet } from "@/lib/intelligence";
import { answerDeterministically } from "@/lib/analyst";
import type { WalletSnapshot } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QUESTION_LENGTH = 500;

const SYSTEM_PROMPT = `You are the intelligence layer of Cookie Intelligence Agent, a wallet analytics dashboard for Cookie Chain (a community-operated SVM Layer 1 whose native token is COOK).

You are given a FACT SHEET computed directly from live Cookie Chain RPC data for one wallet. Follow these rules without exception:

1. Every factual claim — balances, amounts, counts, dates, addresses, signatures — MUST come verbatim from the fact sheet. Never estimate, extrapolate or invent a number.
2. If the fact sheet does not contain what was asked, say so plainly and name what you do have. Never fill a gap with a plausible guess.
3. Never state a USD or fiat value. This app has no price oracle; portfolio shares are by token quantity only, and you must say so whenever you cite a share.
4. Never give financial or investment advice. Describe what the data shows; do not recommend buying, selling or holding.
5. Be concise and concrete: 2-5 sentences, or a short list when ranking things. Use plain language.
6. Amounts are already human-readable — do not convert or rescale them. Native amounts are in COOK.
7. If the fact sheet lists DATA_GAPS that affect the answer, mention the gap.

You are describing the user's own connected wallet, so address them as "your wallet".`;

function isSnapshot(value: unknown): value is WalletSnapshot {
  if (!value || typeof value !== "object") return false;
  const s = value as Partial<WalletSnapshot>;
  return (
    typeof s.address === "string" &&
    Array.isArray(s.holdings) &&
    Array.isArray(s.transactions)
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { question, snapshot } = (body ?? {}) as {
    question?: unknown;
    snapshot?: unknown;
  };

  if (typeof question !== "string" || question.trim().length === 0) {
    return NextResponse.json({ error: "A question is required." }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json(
      { error: `Question must be ${MAX_QUESTION_LENGTH} characters or fewer.` },
      { status: 400 },
    );
  }
  if (!isSnapshot(snapshot)) {
    return NextResponse.json(
      { error: "A wallet snapshot is required. Connect a wallet first." },
      { status: 400 },
    );
  }

  // Recomputed server-side from the submitted snapshot so the model and the UI
  // are always looking at the same derived numbers.
  const analysis = analyseWallet({
    ...snapshot,
    warnings: snapshot.warnings ?? [],
  });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      answer: answerDeterministically(question, analysis),
      mode: "deterministic" as const,
    });
  }

  try {
    const client = new Anthropic({ apiKey });
    const factSheet = buildFactSheet(snapshot, analysis);

    const message = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
      max_tokens: 700,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `<fact_sheet>\n${factSheet}\n</fact_sheet>\n\nQuestion: ${question}`,
        },
      ],
    });

    const answer = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!answer) throw new Error("Empty model response");

    return NextResponse.json({ answer, mode: "ai" as const });
  } catch (error) {
    // A model outage must not take the intelligence panel down — fall back to
    // the deterministic analyst and tell the user which one answered.
    console.error("AI narration failed, falling back to deterministic:", error);
    return NextResponse.json({
      answer: answerDeterministically(question, analysis),
      mode: "deterministic-fallback" as const,
    });
  }
}
