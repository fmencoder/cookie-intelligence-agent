# Submission pack

> **Before submitting, fill in the three placeholders:** `<DEPLOYMENT_URL>`,
> `<TX_SIGNATURE>` and the demo video link. Everything else is ready to paste.

---

## Superteam submission text

**Cookie Intelligence Agent — AI wallet intelligence for Cookie Chain**

🔗 Live app: `<DEPLOYMENT_URL>`
💻 Repo: https://github.com/fmencoder/cookie-intelligence-agent

**What it is**

Connect a Nightly wallet — or paste any address — and Cookie Intelligence Agent reads your
balances, SPL assets, portfolio concentration and transaction history straight off Cookie
Chain, lets you ask questions about them in plain English, and sends COOK with full
transaction feedback.

**What makes it different**

Most "AI + wallet" tools let a language model narrate freely over chain data and hope it
doesn't invent a balance. This one is built so it structurally can't.

The browser fetches the data directly from Cookie Chain. A pure, unit-tested analytics
module reduces it to a deterministic fact sheet — Herfindahl concentration index, net
flows, fees, counterparties, asset activity. Only that fact sheet is handed to the model,
which has no chain access, no tools and no memory. Every number it can say is a number
you can see on the page and verify on CookieScan.

Two consequences fall out of that design:

- **With no API key at all, the app still answers every question**, using a deterministic
  analyst over the same facts. Each answer is labelled with which engine produced it.
- **It refuses to show USD values**, because there's no price oracle wired in. Concentration
  is by token quantity and the UI says so everywhere, rather than inventing prices.

**Cookie Chain integration**

- Solana-dialect JSON-RPC at `rpc.cookiescan.io` — balances, Token + Token-2022 accounts,
  signatures, parsed transactions, epoch info, health, genesis hash
- Cookie DAS API at `api.cookiescan.io` for token metadata, degrading gracefully when
  unavailable
- CookieScan links on every address, mint and signature
- Live chain vitals: slot, epoch progress, node version, measured RPC latency

**Wallet + safety**

Nightly via the official Solana wallet adapter, with real network validation — the genesis
hash the wallet reports is compared against the RPC's, and the dashboard is blocked on
mismatch so you can never read or sign against the wrong SVM chain.

The on-chain action is a native COOK transfer with an optional on-chain memo. No token
approvals, so there's no allowance left dangling. No seed phrase or private key is ever
requested. Transaction status runs PENDING → CONFIRMED / FAILED with the signature, the
confirmation slot, a CookieScan link, and error messages a human can act on.

**Engineering**

Next.js 16 · React 19 · TypeScript · Tailwind v4 · 36 unit tests · zero-config deploy.
Read path is entirely client-side, so there are no server-side chain credentials, no
database, and nothing between you and the node.

📄 Architecture: [docs/ARCHITECTURE.md](https://github.com/fmencoder/cookie-intelligence-agent/blob/main/docs/ARCHITECTURE.md)
✅ Requirement matrix: [docs/REQUIREMENTS.md](https://github.com/fmencoder/cookie-intelligence-agent/blob/main/docs/REQUIREMENTS.md)
🎬 Demo: `<DEMO_VIDEO_URL>`
🧾 Example transaction: `<TX_SIGNATURE>`

---

## X thread

**1/**
Most "AI + wallet" apps let a model narrate blockchain data and hope it doesn't invent a
balance.

I built Cookie Intelligence Agent on @cookiechain so that it structurally can't. 🍪

Live: `<DEPLOYMENT_URL>`

🧵

**2/**
Connect Nightly and you get your Cookie Chain wallet, understood:

· balances + every SPL token account
· portfolio concentration (a real Herfindahl index)
· net flows, fees, counterparties
· full transaction history, every row linked to CookieScan

**3/**
Then ask it things.

"Summarize my wallet."
"What changed recently?"
"What are my largest positions?"

**4/**
Here's the part I actually care about.

The browser fetches the chain data. A pure, unit-tested module reduces it to a fact sheet.
*Only that fact sheet* goes to the model — no chain access, no tools, no memory.

Every number it can say is a number you can verify on CookieScan.

**5/**
Two things fall out of that design:

→ With no API key at all, it still answers every question, deterministically. Each answer is
labelled with which engine produced it.

→ It refuses to print USD values, because there's no price oracle. Shares are by token
quantity and it says so.

Refusing to guess is a feature.

**6/**
Safety, because it's a wallet app:

· genesis-hash network validation — wrong SVM chain = dashboard locked
· one on-chain action: native COOK transfer + memo
· zero token approvals, so no dangling allowance
· no seed phrase, no private key, no server-side chain creds

**7/**
The action itself: send COOK with an on-chain memo, approved in Nightly, tracked
PENDING → CONFIRMED with the signature, the slot, and a CookieScan link.

Errors get translated into something you can act on, not a raw exception.

**8/**
Built on Cookie Chain's SVM stack:

· Solana JSON-RPC at rpc.cookiescan.io
· Cookie DAS API for token metadata
· CookieScan for every link
· Nightly via the official wallet adapter

Next.js 16 · TypeScript · Tailwind v4 · 36 tests

**9/**
No wallet? Paste any Cookie Chain address and explore it read-only. Analyses are shareable
by URL.

Open source: https://github.com/fmencoder/cookie-intelligence-agent

Built for the @SuperteamEarn Cookie Chain bounty. 🍪

---

## Cookie Chain Telegram post

🍪 **Cookie Intelligence Agent** — AI wallet intelligence for Cookie Chain

Just shipped this for the Superteam Cookie Chain bounty.

**Live:** `<DEPLOYMENT_URL>`
**Code:** https://github.com/fmencoder/cookie-intelligence-agent

Connect Nightly (or just paste an address — no wallet needed) and it reads your balances,
SPL assets, portfolio concentration and transaction history straight from Cookie Chain, then
lets you ask about them in plain English:

· "Summarize my wallet"
· "What changed recently?"
· "What are my largest positions?"
· "Which assets are most active?"

**The bit I'd want reviewed:** the model never touches the chain. The browser fetches the
data, a pure unit-tested module reduces it to a fact sheet, and only that goes to the model.
So it can't invent a balance — every number is on the page and verifiable on CookieScan.

It also won't print USD values, because there's no price oracle wired in. Concentration is
by token quantity and the UI says so. Refusing to guess seemed better than making numbers up.

Also in there:
· genesis-hash network validation — wrong SVM network and the dashboard locks
· send COOK with an on-chain memo, PENDING → CONFIRMED, CookieScan link, real error messages
· zero token approvals, no seed phrase, no private keys
· live chain vitals — slot, epoch progress, node version, RPC latency
· works with no API key at all (deterministic analyst answers the same questions)

Built with the standard SVM stack pointed at Cookie Chain: `@solana/web3.js`,
wallet-adapter, `rpc.cookiescan.io`, Cookie DAS API.

Feedback very welcome — especially from anyone running a validator who can sanity-check the
vitals panel. 🍪

---

## Transaction evidence

Record a confirmed Cookie Chain transaction sent through the app here before submitting.

| Field | Value |
| --- | --- |
| Signature | `<TX_SIGNATURE>` |
| Explorer | `https://cookiescan.io/tx/<TX_SIGNATURE>` |
| From | `<SENDER_ADDRESS>` |
| To | `<RECIPIENT_ADDRESS>` |
| Amount | `<AMOUNT>` COOK |
| Memo | `gm from Cookie Intelligence Agent` |
| Status | CONFIRMED |

To produce it: open the deployed app, connect Nightly on Cookie Chain, fill in the Send COOK
panel, approve, and copy the signature from the CONFIRMED card. A screenshot of that card
next to the CookieScan page is the strongest single piece of evidence for the submission.
