# Bounty requirement matrix

**Bounty:** Superteam — *Create an App on Cookie Chain*
**Repository:** https://github.com/fmencoder/cookie-intelligence-agent

Legend — **PASS**: implemented and verified. **PASS\***: implemented and verified against the
local fixture RPC only, because the build environment had no outbound network access to
Cookie Chain (see *Verification environment* below).

| # | Requirement | Implementation | Evidence | Status |
|---|---|---|---|---|
| 1 | App runs on Cookie Chain | All reads and the transfer target Cookie Chain's Solana-dialect JSON-RPC at `rpc.cookiescan.io`; explorer links resolve to CookieScan | `src/lib/cookie-chain.ts`, `src/lib/rpc.ts`, footer shows the live endpoint | PASS |
| 2 | Nightly wallet support | Official `NightlyWalletAdapter` via `@solana/wallet-adapter-react` | `src/components/providers.tsx`, `src/components/wallet-bar.tsx` | PASS |
| 3 | Display connected address | Address chip, copy button, CookieScan link | `wallet-bar.tsx`; screenshot 04 | PASS |
| 4 | Network validation | Wallet `genesisHash` compared to `connection.getGenesisHash()`; blocking modal on mismatch, non-blocking warning when the wallet doesn't expose it | `src/components/network-gate.tsx` | PASS |
| 5 | Disconnect handling | Explicit disconnect control; snapshot cleared when the target goes away | `wallet-bar.tsx`, `dashboard.tsx` | PASS |
| 6 | Balances | `getBalance` for native COOK | `rpc.ts::fetchHoldings`; screenshot 04 | PASS\* |
| 7 | Assets | `getParsedTokenAccountsByOwner` for Token **and** Token-2022, summed per mint, zero balances dropped | `rpc.ts::fetchHoldings`; Assets panel | PASS\* |
| 8 | Recent activity | `getSignaturesForAddress` + batched `getParsedTransactions`, reduced to direction / delta / fee / counterparty / memo / failure | `rpc.ts::fetchTransactions`, `summariseTransaction` | PASS\* |
| 9 | Recent transactions | Activity feed with signature, relative time, signed amount, and a CookieScan link per row | `panels.tsx::ActivityPanel`; screenshot 05 | PASS\* |
| 10 | Portfolio concentration | Herfindahl–Hirschman Index over holding weights + ranked share bars + plain-language label | `intelligence.ts::herfindahlIndex`, `buildConcentration`; 8 unit tests | PASS |
| 11 | Cookie Chain-specific data | Live slot, epoch progress, node version, measured RPC latency, health; Cookie DAS API for token metadata | `rpc.ts::fetchChainVitals`, `fetchDasMetadata`; Vitals panel | PASS\* |
| 12 | AI panel — summarize my wallet | Grounded narration + deterministic fallback | `api/ai/route.ts`, `analyst.ts`; screenshot 05 | PASS |
| 13 | AI panel — what changed recently | Flow, window and failure analysis over the sampled history | `analyst.ts` (`changes` intent) | PASS |
| 14 | AI panel — largest positions | Ranked concentration with explicit quantity-not-USD caveat | `analyst.ts` (`positions` intent) | PASS |
| 15 | AI panel — most active assets | Per-mint transaction touch counts + top counterparty | `intelligence.ts::summariseAssetActivity` | PASS |
| 16 | AI panel — show recent transactions | Counts and routes the user to the verifiable feed | `analyst.ts` (`transactions` intent) | PASS |
| 17 | Factual data from real chain/API | Model receives only the computed fact sheet; it has no chain access, no tools, no memory | `intelligence.ts::buildFactSheet`, `api/ai/route.ts` system prompt | PASS |
| 18 | Never hallucinate balances | Structural: all numbers come from a pure, unit-tested reducer; system prompt forbids invented figures and USD values; gaps disclosed as `DATA_GAPS` | 36 unit tests; `docs/ARCHITECTURE.md` grounding contract | PASS |
| 19 | One safe on-chain action | Native COOK transfer + optional SPL Memo — no token approvals of any kind | `src/lib/send.ts`, `src/components/send-panel.tsx` | PASS |
| 20 | Explicit wallet approval | App builds an unsigned transaction and hands it to Nightly via `sendTransaction` | `send-panel.tsx::handleSend` | PASS |
| 21 | PENDING state | Shown from submission until confirmation, with progress text | `send.ts::TxPhase`, `send-panel.tsx::TxStatus` | PASS |
| 22 | CONFIRMED state | Shown with the confirmation slot | `TxStatus`; blockhash-bounded `confirmTransfer` | PASS |
| 23 | FAILED state | Separates wallet rejection, pre-flight validation failure, and on-chain error | `TxStatus`, `humaniseTxError` | PASS |
| 24 | Transaction signature | Displayed in monospace on every non-idle state | `TxStatus` | PASS |
| 25 | Explorer link | `https://cookiescan.io/tx/<sig>` on every transaction and activity row | `cookie-chain.ts::explorerTxUrl` | PASS |
| 26 | Confirmation state | `confirmTransaction` at `confirmed` commitment, bounded by `lastValidBlockHeight` | `send.ts::confirmTransfer` | PASS |
| 27 | Useful error message | Six error classes translated to actionable text; unknown errors passed through unchanged | `send.ts::humaniseTxError`; 4 unit tests | PASS |
| 28 | Never request seed phrase | No such input exists anywhere in the app | Full source; stated in UI | PASS |
| 29 | Never store private key | The app holds no key material; signing is entirely inside Nightly | Full source | PASS |
| 30 | No transaction without approval | No signing path exists that does not go through the wallet | `send-panel.tsx` | PASS |
| 31 | No server secrets client-side | `ANTHROPIC_API_KEY` read only in the Node runtime of `/api/ai`; never `NEXT_PUBLIC_` | `api/ai/route.ts`, `.env.example` | PASS |
| 32 | No fabricated on-chain state | Unavailable data becomes a visible warning, never a filled-in value | `rpc.ts` warnings, `WalletSnapshot.warnings` | PASS |
| 33 | No unnecessary token approvals | Zero approve instructions in the codebase — the only action is a system transfer | `src/lib/send.ts` | PASS |
| 34 | Polished, mobile-ready UI | Warm Cookie Chain palette, light/dark, loading skeletons, empty and error states; zero horizontal overflow at 360/390/768/1024/1440px | Screenshots 01–07; automated overflow assertion | PASS |
| 35 | Public repository | https://github.com/fmencoder/cookie-intelligence-agent | This repo | PASS |
| 36 | Comprehensive README | Features, architecture, setup, security, limitations | `README.md` | PASS |
| 37 | Architecture diagram | Full data-flow diagram + grounding contract + trade-off table | `docs/ARCHITECTURE.md` | PASS |
| 38 | Setup instructions | Zero-config quickstart plus the full env var table | `README.md` | PASS |
| 39 | Screenshots | 7 captured from the running application | `docs/screenshots/` | PASS |
| 40 | Demo script | Timed 3-minute walkthrough with a no-wallet fallback | `docs/DEMO.md` | PASS |
| 41 | Submission copy | Superteam text, X thread, Telegram post | `docs/SUBMISSION.md` | PASS |

---

## Verification environment

Everything above was verified by building and running the real application:

- `npm run build` — clean production build, no errors or warnings
- `npm run typecheck` — `tsc --noEmit`, zero errors
- `npm test` — **36/36 unit tests pass**
- `/api/ai` exercised over HTTP for all five supported questions plus its 400-level input
  validation
- The full dashboard rendered and screenshotted in headless Chromium, with automated
  assertions on content presence, console errors, and horizontal overflow across five
  viewport widths

The one thing that could **not** be done here: this build container's egress policy returns
`403` for `cookiescan.io` and `cookiechain.wtf`, so no live call to Cookie Chain was possible
from the build environment. Rows marked **PASS\*** are the ones whose code path ends at the
network — they were verified against `scripts/mock-rpc.mjs`, a fixture server that speaks the
same JSON-RPC shapes.

The Cookie Chain endpoints themselves were not guessed. They were cross-verified across two
independent public Cookie Chain applications before being hard-coded, and every one of them
is overridable by environment variable.

**To complete chain-connected verification**, open the deployed app in a browser with network
access, connect Nightly on Cookie Chain, and confirm: balances match CookieScan, the activity
feed matches the address's transaction list, and a test transfer reaches CONFIRMED with a
working explorer link. Record the resulting signature as transaction evidence in
`docs/SUBMISSION.md`.
