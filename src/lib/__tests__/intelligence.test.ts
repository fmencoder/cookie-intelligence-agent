import { describe, expect, it } from "vitest";
import {
  analyseWallet,
  buildConcentration,
  buildFactSheet,
  herfindahlIndex,
  labelConcentration,
} from "@/lib/intelligence";
import { answerDeterministically, classifyIntent } from "@/lib/analyst";
import { validateTransfer, humaniseTxError } from "@/lib/send";
import { formatAmount } from "@/lib/cookie-chain";
import type { WalletSnapshot, WalletTransaction } from "@/lib/types";

function tx(partial: Partial<WalletTransaction> = {}): WalletTransaction {
  return {
    signature: Math.random().toString(36).slice(2),
    blockTime: 1_700_000_000,
    slot: 100,
    failed: false,
    err: null,
    feeCook: 0.000005,
    nativeChangeCook: 0,
    direction: "other",
    counterparty: null,
    touchedMints: [],
    programIds: [],
    memo: null,
    ...partial,
  };
}

function snapshot(partial: Partial<WalletSnapshot> = {}): WalletSnapshot {
  return {
    address: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
    fetchedAt: 1_700_000_500_000,
    nativeBalanceCook: 10,
    holdings: [
      {
        mint: "native",
        symbol: "COOK",
        name: "Cookie Chain",
        amount: 10,
        decimals: 9,
        rawAmount: "10000000000",
        isNative: true,
      },
    ],
    transactions: [],
    vitals: null,
    warnings: [],
    ...partial,
  };
}

describe("herfindahlIndex", () => {
  it("is 1 for a single holding", () => {
    expect(herfindahlIndex([42])).toBe(1);
  });

  it("approaches 1/n for n equal holdings", () => {
    expect(herfindahlIndex([1, 1, 1, 1])).toBeCloseTo(0.25, 10);
  });

  it("is higher for a more concentrated split", () => {
    expect(herfindahlIndex([90, 10])).toBeGreaterThan(herfindahlIndex([50, 50]));
  });

  it("returns 0 rather than NaN for an empty or zero portfolio", () => {
    expect(herfindahlIndex([])).toBe(0);
    expect(herfindahlIndex([0, 0])).toBe(0);
  });

  it("ignores negative weights instead of skewing the total", () => {
    expect(herfindahlIndex([-5, 10])).toBe(1);
  });
});

describe("labelConcentration", () => {
  it("labels each band", () => {
    expect(labelConcentration(0, 0)).toBe("empty");
    expect(labelConcentration(1, 1)).toBe("single-asset");
    expect(labelConcentration(0.8, 3)).toBe("concentrated");
    expect(labelConcentration(0.3, 4)).toBe("balanced");
    expect(labelConcentration(0.1, 12)).toBe("diversified");
  });
});

describe("buildConcentration", () => {
  it("ranks holdings by share and excludes zero balances", () => {
    const result = buildConcentration(
      snapshot({
        holdings: [
          { mint: "native", symbol: "COOK", name: "Cookie Chain", amount: 25, decimals: 9, rawAmount: "0", isNative: true },
          { mint: "mintA", symbol: "AAA", name: "A", amount: 75, decimals: 6, rawAmount: "0", isNative: false },
          { mint: "mintB", symbol: "BBB", name: "B", amount: 0, decimals: 6, rawAmount: "0", isNative: false },
        ],
      }),
    );

    expect(result).toHaveLength(2);
    expect(result[0].symbol).toBe("AAA");
    expect(result[0].share).toBeCloseTo(0.75, 10);
    expect(result[1].share).toBeCloseTo(0.25, 10);
  });

  it("returns an empty ranking when nothing is held", () => {
    expect(buildConcentration(snapshot({ holdings: [] }))).toEqual([]);
  });
});

describe("analyseWallet", () => {
  it("separates inflows from outflows and sums fees", () => {
    const analysis = analyseWallet(
      snapshot({
        transactions: [
          tx({ nativeChangeCook: 5, feeCook: 0.000005 }),
          tx({ nativeChangeCook: -2, feeCook: 0.000005 }),
          tx({ nativeChangeCook: -1, feeCook: 0.00001 }),
        ],
      }),
    );

    expect(analysis.inflowCook).toBe(5);
    expect(analysis.outflowCook).toBe(3);
    expect(analysis.netFlowCook).toBe(2);
    expect(analysis.feesPaidCook).toBeCloseTo(0.00002, 10);
  });

  it("computes the success rate and counts failures", () => {
    const analysis = analyseWallet(
      snapshot({ transactions: [tx(), tx(), tx({ failed: true, err: '"InstructionError"' })] }),
    );

    expect(analysis.txCount).toBe(3);
    expect(analysis.failedTxCount).toBe(1);
    expect(analysis.successRate).toBeCloseTo(2 / 3, 10);
  });

  it("reports a perfect success rate for an empty history rather than dividing by zero", () => {
    const analysis = analyseWallet(snapshot());
    expect(analysis.txCount).toBe(0);
    expect(analysis.successRate).toBe(1);
    expect(Number.isNaN(analysis.successRate)).toBe(false);
  });

  it("windows activity against the latest transaction, not wall-clock now", () => {
    const latest = 1_700_000_000;
    const analysis = analyseWallet(
      snapshot({
        transactions: [
          tx({ blockTime: latest }),
          tx({ blockTime: latest - 3_600 }),
          tx({ blockTime: latest - 3 * 86_400 }),
          tx({ blockTime: latest - 30 * 86_400 }),
        ],
      }),
    );

    expect(analysis.txLast24h).toBe(2);
    expect(analysis.txLast7d).toBe(3);
    expect(analysis.lastActive).toBe(latest);
    expect(analysis.firstSeen).toBe(latest - 30 * 86_400);
  });

  it("ranks counterparties by interaction count", () => {
    const analysis = analyseWallet(
      snapshot({
        transactions: [
          tx({ counterparty: "alice", nativeChangeCook: -1 }),
          tx({ counterparty: "alice", nativeChangeCook: -2 }),
          tx({ counterparty: "bob", nativeChangeCook: 5 }),
        ],
      }),
    );

    expect(analysis.topCounterparties[0].address).toBe("alice");
    expect(analysis.topCounterparties[0].interactions).toBe(2);
    expect(analysis.topCounterparties[0].netCook).toBe(-3);
  });

  it("attributes native-only movement to COOK in asset activity", () => {
    const analysis = analyseWallet(
      snapshot({ transactions: [tx({ nativeChangeCook: -1 }), tx({ touchedMints: ["mintA"] })] }),
    );

    const symbols = analysis.mostActiveAssets.map((a) => a.symbol);
    expect(symbols).toContain("COOK");
    expect(analysis.mostActiveAssets.find((a) => a.mint === "mintA")?.touches).toBe(1);
  });
});

describe("buildFactSheet", () => {
  it("includes the real balance and forbids USD figures", () => {
    const snap = snapshot({ nativeBalanceCook: 12.5 });
    const sheet = buildFactSheet(snap, analyseWallet(snap));

    expect(sheet).toContain("NATIVE_BALANCE_COOK: 12.5");
    expect(sheet).toContain("Never state a USD figure");
    expect(sheet).toContain(snap.address);
  });

  it("surfaces data gaps so the model can be honest about them", () => {
    const snap = snapshot({ warnings: ["Cookie DAS API was unreachable"] });
    const sheet = buildFactSheet(snap, analyseWallet(snap));

    expect(sheet).toContain("DATA_GAPS");
    expect(sheet).toContain("Cookie DAS API was unreachable");
  });

  it("marks empty sections explicitly rather than leaving them blank", () => {
    const snap = snapshot({ holdings: [], transactions: [] });
    const sheet = buildFactSheet(snap, analyseWallet(snap));
    expect(sheet).toContain("(none)");
  });
});

describe("classifyIntent", () => {
  it("maps every suggested question to a concrete intent", () => {
    expect(classifyIntent("Summarize my wallet")).toBe("summary");
    expect(classifyIntent("What changed recently?")).toBe("changes");
    expect(classifyIntent("What are my largest positions?")).toBe("positions");
    expect(classifyIntent("Which assets are most active?")).toBe("activity");
    expect(classifyIntent("Show recent transactions")).toBe("transactions");
  });
});

describe("answerDeterministically", () => {
  const populated = snapshot({
    nativeBalanceCook: 10,
    holdings: [
      { mint: "native", symbol: "COOK", name: "Cookie Chain", amount: 10, decimals: 9, rawAmount: "0", isNative: true },
      { mint: "mintA", symbol: "AAA", name: "A", amount: 30, decimals: 6, rawAmount: "0", isNative: false },
    ],
    transactions: [tx({ nativeChangeCook: 5 }), tx({ nativeChangeCook: -2 })],
  });

  it("quotes only figures present in the analysis", () => {
    const analysis = analyseWallet(populated);
    const answer = answerDeterministically("Summarize my wallet", analysis);

    expect(answer).toContain("10 COOK");
    expect(answer).toContain("2 distinct assets");
    expect(answer).not.toMatch(/\$/);
  });

  it("names the largest position correctly", () => {
    const answer = answerDeterministically(
      "What are my largest positions?",
      analyseWallet(populated),
    );
    expect(answer).toContain("AAA");
    expect(answer).toContain("75.0%");
  });

  it("says plainly when there is no history instead of inventing one", () => {
    const answer = answerDeterministically("What changed recently?", analyseWallet(snapshot()));
    expect(answer).toContain("No transactions were found");
  });

  it("falls back to guidance for an unrecognised question", () => {
    const answer = answerDeterministically("what is the meaning of life", analyseWallet(populated));
    expect(answer).toContain("Summarize my wallet");
  });
});

describe("validateTransfer", () => {
  const valid = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";

  it("accepts a well-formed transfer", () => {
    const result = validateTransfer(valid, "1.5", 10, null);
    expect(result.ok).toBe(true);
    expect(result.lamports).toBe(1_500_000_000);
  });

  it("rejects a malformed address", () => {
    expect(validateTransfer("not-an-address", "1", 10, null).ok).toBe(false);
  });

  it("rejects an empty recipient", () => {
    expect(validateTransfer("   ", "1", 10, null).ok).toBe(false);
  });

  it("rejects sending to yourself", () => {
    const result = validateTransfer(valid, "1", 10, valid);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/your own address/);
  });

  it("rejects non-positive and non-numeric amounts", () => {
    expect(validateTransfer(valid, "0", 10, null).ok).toBe(false);
    expect(validateTransfer(valid, "-1", 10, null).ok).toBe(false);
    expect(validateTransfer(valid, "abc", 10, null).ok).toBe(false);
    expect(validateTransfer(valid, "", 10, null).ok).toBe(false);
  });

  it("leaves fee headroom so a max-balance send cannot fail for one lamport", () => {
    const result = validateTransfer(valid, "10", 10, null);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/exceeds your spendable balance/);
    expect(validateTransfer(valid, "9.9", 10, null).ok).toBe(true);
  });
});

describe("humaniseTxError", () => {
  it("turns a wallet rejection into a reassuring message", () => {
    const message = humaniseTxError(new Error("User rejected the request."));
    expect(message).toMatch(/Nothing was sent/);
  });

  it("explains an expired blockhash", () => {
    expect(humaniseTxError(new Error("Blockhash not found"))).toMatch(/expired/);
  });

  it("explains insufficient funds", () => {
    expect(humaniseTxError(new Error("insufficient lamports 100, need 200"))).toMatch(
      /Insufficient COOK/,
    );
  });

  it("passes an unrecognised error through rather than swallowing it", () => {
    expect(humaniseTxError(new Error("weird node failure"))).toBe("weird node failure");
  });
});

describe("formatAmount", () => {
  it("renders a clean threshold instead of an IEEE-754 artifact", () => {
    // 10 ** -4 === 0.00009999999999999999, which must never reach the UI.
    expect(formatAmount(0.000005, 4)).toBe("<0.0001");
    expect(formatAmount(0.000005, 4)).not.toContain("999");
  });

  it("keeps the sign on a tiny negative amount", () => {
    expect(formatAmount(-0.000005, 4)).toBe("-<0.0001");
  });

  it("renders zero and ordinary values normally", () => {
    expect(formatAmount(0)).toBe("0");
    expect(formatAmount(1234.5)).toBe("1,234.5");
  });

  it("returns an em dash for non-finite input", () => {
    expect(formatAmount(Number.NaN)).toBe("—");
    expect(formatAmount(Number.POSITIVE_INFINITY)).toBe("—");
  });
});
