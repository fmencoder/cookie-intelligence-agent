/**
 * Local mock Cookie Chain RPC — UI VERIFICATION ONLY.
 *
 * This exists so the dashboard's full render path (loading → fetch → analyse →
 * paint) can be exercised and screenshotted in CI or offline, where the real
 * Cookie Chain RPC is not reachable.
 *
 * It serves FIXTURE DATA. Anything rendered against it is a UI check, never
 * evidence about the chain. Point the app at the real RPC for real data:
 *
 *   node scripts/mock-rpc.mjs &
 *   NEXT_PUBLIC_COOKIE_RPC_URL=http://127.0.0.1:8899 \
 *   NEXT_PUBLIC_COOKIE_DAS_URL=http://127.0.0.1:8899 npm run build && npm start
 */

import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_RPC_PORT ?? 8899);
const SLOT = 41_882_517;
const OWNER = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";

const MINT_CHIP = "CHiP5Vk2ZTqAoGmYtCn9dEjqPrX8sWqLfBn3TdRkMuJp";
const MINT_DOUGH = "DoUGH7yqEr4mKcVbNtQzWpLs2XaHjFdRkYn6TvBcM1Ge";

const jsonRpc = (id, result) => ({ jsonrpc: "2.0", id, result });
const ctx = (value) => ({ context: { apiVersion: "2.1.0", slot: SLOT }, value });

function tokenAccount(pubkey, mint, amount, decimals) {
  return {
    pubkey,
    account: {
      executable: false,
      lamports: 2_039_280,
      owner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      rentEpoch: 0,
      space: 165,
      data: {
        program: "spl-token",
        space: 165,
        parsed: {
          type: "account",
          info: {
            mint,
            owner: OWNER,
            state: "initialized",
            tokenAmount: {
              amount: String(Math.round(amount * 10 ** decimals)),
              decimals,
              uiAmount: amount,
              uiAmountString: String(amount),
            },
          },
        },
      },
    },
  };
}

const NOW = Math.floor(Date.now() / 1000);

// A varied history so every panel and code path has something to render.
const HISTORY = [
  { sig: "4Wm7QhKcVbNtRzYpLs2XaHjFdRkYn6TvBcM1GeUoPqRsTuVwXyZa1B2c3D4e5F6g7H8i", ago: 900, delta: 12.5, fee: 5000, memo: "gm from Cookie Intelligence Agent", err: null },
  { sig: "5Xn8RiLdWcOuSzAqMt3YbIkGeSlZo7UwCdN2HfVpQrStUvWxYzAb2C3d4E5f6G7h8I9j", ago: 5_400, delta: -3.25, fee: 5000, memo: null, err: null },
  { sig: "6Yo9SjMeXdPvTaBrNu4ZcJlHfTmAp8VxDeO3IgWqRsTuVwXyZaBc3D4e5F6g7H8i9J0k", ago: 26_000, delta: -0.75, fee: 5000, memo: null, err: null },
  { sig: "7Zp0TkNfYeQwUbCsOv5AdKmIgUnBq9WyEfP4JhXrStUvWxYzAbCd4E5f6G7h8I9j0K1l", ago: 92_000, delta: 40, fee: 5000, memo: "airdrop", err: null },
  { sig: "8Aq1UlOgZfRxVcDtPw6BeLnJhVoCr0XzFgQ5KiYsTuVwXyZaBcDe5F6g7H8i9J0k1L2m", ago: 190_000, delta: -0.000005, fee: 5000, memo: null, err: { InstructionError: [0, { Custom: 1 }] } },
  { sig: "9Br2VmPhAgSyWdEuQx7CfMoKiWpDs1YaGhR6LjZtUvWxYzAbCdEf6G7h8I9j0K1l2M3n", ago: 610_000, delta: -8.5, fee: 5000, memo: "cookieswap", err: null },
];

function parsedTransaction(entry) {
  const lamports = Math.round(entry.delta * 1e9);
  const counterparty = "CoUnTeRpArTy1111111111111111111111111111111";
  return {
    blockTime: NOW - entry.ago,
    slot: SLOT - Math.floor(entry.ago / 0.4),
    transaction: {
      signatures: [entry.sig],
      message: {
        accountKeys: [
          { pubkey: OWNER, signer: true, writable: true, source: "transaction" },
          { pubkey: counterparty, signer: false, writable: true, source: "transaction" },
          { pubkey: "11111111111111111111111111111111", signer: false, writable: false, source: "transaction" },
        ],
        instructions: [
          { programId: "11111111111111111111111111111111", program: "system", parsed: {} },
        ],
        recentBlockhash: "HrHrHrHrHrHrHrHrHrHrHrHrHrHrHrHrHrHrHrHrHrH",
      },
    },
    meta: {
      err: entry.err,
      fee: entry.fee,
      preBalances: [100_000_000_000, 50_000_000_000, 1],
      postBalances: [100_000_000_000 + lamports - entry.fee, 50_000_000_000 - lamports, 1],
      preTokenBalances: [],
      postTokenBalances: [],
      logMessages: entry.memo
        ? [`Program log: Memo (len ${entry.memo.length}): "${entry.memo}"`]
        : ["Program 11111111111111111111111111111111 success"],
      innerInstructions: [],
      rewards: [],
      status: entry.err ? { Err: entry.err } : { Ok: null },
    },
    version: 0,
  };
}

function handle({ id, method, params }) {
  switch (method) {
    case "getGenesisHash":
      return jsonRpc(id, "CookieChainMockGenesisHash1111111111111111111");
    case "getHealth":
      return jsonRpc(id, "ok");
    case "getVersion":
      return jsonRpc(id, { "solana-core": "2.1.0", "feature-set": 3271415109 });
    case "getEpochInfo":
      return jsonRpc(id, {
        absoluteSlot: SLOT,
        blockHeight: SLOT - 1200,
        epoch: 96,
        slotIndex: 291_402,
        slotsInEpoch: 432_000,
        transactionCount: 1_842_991_233,
      });
    case "getBalance":
      return jsonRpc(id, ctx(74_318_450_000));
    case "getTokenAccountsByOwner": {
      const programId = params?.[1]?.programId;
      if (programId === "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb") {
        return jsonRpc(id, ctx([]));
      }
      return jsonRpc(
        id,
        ctx([
          tokenAccount("TokAcc1111111111111111111111111111111111111", MINT_CHIP, 18_450.25, 6),
          tokenAccount("TokAcc2222222222222222222222222222222222222", MINT_DOUGH, 942.5, 9),
        ]),
      );
    }
    case "getSignaturesForAddress":
      return jsonRpc(
        id,
        HISTORY.map((h) => ({
          signature: h.sig,
          slot: SLOT - Math.floor(h.ago / 0.4),
          err: h.err,
          memo: null,
          blockTime: NOW - h.ago,
          confirmationStatus: "finalized",
        })),
      );
    case "getTransaction": {
      const sig = params?.[0];
      const entry = HISTORY.find((h) => h.sig === sig);
      return jsonRpc(id, entry ? parsedTransaction(entry) : null);
    }
    case "getAssetsByOwner":
      return jsonRpc(id, {
        total: 2,
        limit: 200,
        page: 1,
        items: [
          {
            id: MINT_CHIP,
            content: { metadata: { name: "Chocolate Chip", symbol: "CHIP" } },
            token_info: { symbol: "CHIP", decimals: 6 },
          },
          {
            id: MINT_DOUGH,
            content: { metadata: { name: "Cookie Dough", symbol: "DOUGH" } },
            token_info: { symbol: "DOUGH", decimals: 9 },
          },
        ],
      });
    case "getLatestBlockhash":
      return jsonRpc(
        id,
        ctx({ blockhash: "HrHrHrHrHrHrHrHrHrHrHrHrHrHrHrHrHrHrHrHrHrH", lastValidBlockHeight: SLOT + 150 }),
      );
    default:
      return { jsonrpc: "2.0", id, error: { code: -32601, message: `Mock RPC: ${method} not implemented` } };
  }
}

createServer((req, res) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") {
    res.writeHead(204, headers).end();
    return;
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      res.writeHead(400, headers).end(JSON.stringify({ error: "bad json" }));
      return;
    }
    // web3.js batches getParsedTransactions as a JSON-RPC array.
    const result = Array.isArray(payload) ? payload.map(handle) : handle(payload);
    res.writeHead(200, headers).end(JSON.stringify(result));
  });
}).listen(PORT, "127.0.0.1", () => {
  console.log(`Mock Cookie Chain RPC (FIXTURE DATA) on http://127.0.0.1:${PORT}`);
});
