# Demo script — Cookie Intelligence Agent

**Target length: 3 minutes.** Have Nightly installed with Cookie Chain added as a custom SVM
RPC (`https://rpc.cookiescan.io`) and a small COOK balance, plus a second address to send to.

---

## 0:00 — The problem (20s)

> "Most AI wallet tools let a language model talk freely over blockchain data and hope it
> doesn't invent a balance. I built Cookie Intelligence Agent on Cookie Chain so that it
> structurally can't."

Show the landing page.

## 0:20 — Connect (25s)

Click **Connect Nightly** → approve.

> "Nightly connects through the official Solana wallet adapter. Cookie Chain is an SVM
> chain, so the whole toolchain works — I just point it at Cookie Chain's RPC."

**Show the network check.** If you have a second network in Nightly, switch to it first and
reconnect to demo the blocking modal:

> "If the wallet is on the wrong SVM network, the dashboard locks. You can't read or sign
> against the wrong chain by accident. Here's the RPC to paste, one click to copy."

Switch back to Cookie Chain, re-check, dashboard unlocks.

## 0:45 — The intelligence (45s)

Walk the dashboard top to bottom:

> "Balances and every SPL token account, read in the browser directly from Cookie Chain —
> there's no backend in the middle. Token names come from the Cookie DAS API."

Point at **Concentration**:

> "That's a real Herfindahl index over the holdings. And note what it says: shares are by
> token *quantity*, not dollars. There's no price oracle here, so the app refuses to show a
> USD number rather than making one up."

Point at **Cookie Chain vitals** and **Recent activity**:

> "Live slot, epoch progress, and measured RPC latency. Every transaction row links to
> CookieScan — you can verify any number on this page independently."

## 1:30 — Ask it something (40s)

Click **Summarize my wallet**.

> "The model never touches the chain. The browser fetches the data, a pure, unit-tested
> module reduces it to a fact sheet, and only that fact sheet goes to Claude. Every figure
> in this answer is a figure on the screen."

Click **What are my largest positions?**

> "And it's labelled — you always know whether an AI or the deterministic analyst answered.
> With no API key configured, that deterministic engine answers every one of these questions
> on its own. The product doesn't need a model to be useful."

## 2:10 — Send COOK (40s)

Paste the recipient, enter a small amount, add the memo `gm from Cookie Intelligence Agent`.
Click **Review & send** → approve in Nightly.

> "One safe on-chain action: a native COOK transfer with an on-chain memo. No token
> approvals, so there's no allowance left dangling. The app never holds a key — Nightly signs."

Show the status transition:

> "PENDING while it confirms… and CONFIRMED, with the signature, the slot, and a CookieScan
> link."

Click the CookieScan link. Show the transaction on the explorer.

> "There it is on chain."

## 2:50 — Close (15s)

Click **Refresh** — the new transaction appears at the top of Recent Activity.

> "Balances update, the transaction is in the feed, and the next AI answer already knows
> about it. Open source, deployed, and it runs with zero configuration."

---

## Backup: no wallet available

Paste any Cookie Chain address into the landing page's **"or explore without connecting"**
field. The full read-only dashboard and intelligence panel work without a wallet — only
sending is gated. Share the resulting `/?address=…` URL.

## Things to have open in tabs

1. The deployed app
2. CookieScan (`https://cookiescan.io`)
3. The GitHub repo — specifically `src/lib/intelligence.ts` and the test file, if anyone
   asks how grounding is enforced
