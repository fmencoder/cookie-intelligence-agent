# Architecture

## Design goal

A wallet analytics tool is only useful if you can trust its numbers. The single hardest
requirement in this build was **"never hallucinate balances or transactions"** — and a
system prompt asking a model nicely is not an architecture.

So the trust boundary is structural: the language model is never given the ability to state
a number that did not come from the chain.

## System diagram

```
┌──────────────────────────────── BROWSER ────────────────────────────────┐
│                                                                          │
│  Nightly wallet ──── signs ────┐                                         │
│        │                       │                                         │
│        │ genesisHash           ▼                                         │
│        │              ┌──────────────────┐                               │
│        └─────────────►│  NetworkGate     │  blocks the UI on mismatch    │
│                       └──────────────────┘                               │
│                                                                          │
│  ┌────────────────┐   Solana JSON-RPC    ┌───────────────────────────┐   │
│  │  lib/rpc.ts    │◄────────────────────►│  rpc.cookiescan.io        │   │
│  │                │                      │  · getBalance             │   │
│  │  fetchWallet   │                      │  · getTokenAccountsByOwner│   │
│  │  Snapshot()    │                      │  · getSignaturesForAddress│   │
│  │                │                      │  · getParsedTransactions  │   │
│  │                │                      │  · getEpochInfo/Health    │   │
│  │                │   DAS (optional)     ├───────────────────────────┤   │
│  │                │◄────────────────────►│  api.cookiescan.io        │   │
│  └────────┬───────┘                      │  · getAssetsByOwner       │   │
│           │                              └───────────────────────────┘   │
│           ▼                                                              │
│    WalletSnapshot            ← raw, honest, includes `warnings[]`        │
│           │                                                              │
│           ▼                                                              │
│  ┌──────────────────────┐                                                │
│  │ lib/intelligence.ts  │  PURE · NO I/O · 36 UNIT TESTS                 │
│  │  analyseWallet()     │  HHI · flows · fees · counterparties           │
│  │  buildFactSheet()    │  windows · asset activity · highlights         │
│  └──────────┬───────────┘                                                │
│             │                                                            │
│      ┌──────┴───────┐                                                    │
│      ▼              ▼                                                    │
│   Dashboard      POST /api/ai  { question, snapshot }                    │
│   panels            │                                                    │
└─────────────────────┼────────────────────────────────────────────────────┘
                      │
┌─────────────────────┼──────────── SERVER (Node runtime) ─────────────────┐
│                     ▼                                                     │
│         re-runs analyseWallet() on the submitted snapshot                 │
│                     │                                                     │
│         ┌───────────┴────────────┐                                        │
│         │ ANTHROPIC_API_KEY set? │                                        │
│         └───────────┬────────────┘                                        │
│              yes    │    no                                               │
│         ┌───────────┘    └──────────┐                                     │
│         ▼                           ▼                                     │
│   Claude (fact sheet only)    lib/analyst.ts                              │
│   · no chain access           deterministic answers                       │
│   · no tools                  from the same analysis                      │
│   · no memory                                                             │
│         └───────────┬───────────────┘                                     │
│                     ▼   { answer, mode }   ← mode is shown in the UI      │
└───────────────────────────────────────────────────────────────────────────┘
```

## The grounding contract

1. **Fetch.** `lib/rpc.ts` runs in the browser and talks straight to Cookie Chain. There is
   no backend between the node and the user that could reshape the data.
2. **Reduce.** `lib/intelligence.ts` is a pure function of the snapshot — no network, no
   clock reads that affect results, no randomness. It is where every displayed number is
   computed, and it is the module the tests concentrate on.
3. **Narrate.** `/api/ai` recomputes the analysis server-side from the submitted snapshot,
   renders it as a text fact sheet, and gives the model *only that*, under a system prompt
   forbidding invented numbers, USD values and financial advice.
4. **Attribute.** Every answer is tagged in the UI with which engine produced it
   (`AI narration` / `Deterministic analyst`), so a reader always knows what they are
   looking at.
5. **Disclose.** Failures degrade into `warnings[]`, which appear both in the dashboard and
   in the fact sheet's `DATA_GAPS` section, so the model is told what it does *not* know.

Because step 2 is pure and tested, and step 3 has no other input, a wrong number in an
answer would have to be a wrong number on the screen too — which the tests are designed to
catch.

## Why the read path is client-side

- **No server-side chain credentials** to leak or rotate.
- **Verifiability** — the user's browser is talking to the same public RPC they can curl.
- **Deployability** — the app is a static shell plus one API route; it runs on Vercel's free
  tier with no database, no session store and no background workers.
- **Resilience** — an outage of the AI route degrades the intelligence panel to the
  deterministic analyst, and leaves the entire dashboard untouched.

## Module map

| Path | Responsibility |
| --- | --- |
| `src/lib/cookie-chain.ts` | Network constants, explorer URLs, formatters |
| `src/lib/types.ts` | Shared domain types |
| `src/lib/rpc.ts` | All Cookie Chain reads; snapshot assembly |
| `src/lib/intelligence.ts` | Pure analytics + fact-sheet construction |
| `src/lib/analyst.ts` | Deterministic question answering |
| `src/lib/send.ts` | Transfer validation, building, confirmation, error humanisation |
| `src/app/api/ai/route.ts` | Grounded narration endpoint |
| `src/components/providers.tsx` | Connection + Nightly wallet adapter |
| `src/components/network-gate.tsx` | Genesis-hash network validation |
| `src/components/dashboard.tsx` | Fetch → analyse → render orchestration |
| `src/components/panels.tsx` | Overview, concentration, assets, activity, vitals |
| `src/components/ai-panel.tsx` | Intelligence panel |
| `src/components/send-panel.tsx` | On-chain action + transaction lifecycle |
| `scripts/mock-rpc.mjs` | Fixture RPC for offline UI verification (not chain data) |

## Trade-offs taken

| Decision | Why | Cost |
| --- | --- | --- |
| Client-side reads | No server secrets, verifiable, cheap to run | Relies on the RPC allowing browser CORS |
| Quantity-weighted concentration | No price oracle exists for this app; inventing prices would violate the core requirement | Weights are not USD-comparable, stated everywhere |
| 40-transaction sample | One round trip, fast first paint | Statistics describe a window, not all history |
| Hand-rolled UI primitives | No registry fetch, smaller bundle, full control | Fewer components than a full shadcn install |
| Single wallet (Nightly) | The bounty's target wallet; no modal needed | Other wallets need an adapter added to `providers.tsx` |
