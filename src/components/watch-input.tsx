"use client";

/**
 * Read-only address lookup.
 *
 * The dashboard is useful without a wallet: anyone can inspect any Cookie Chain
 * address. That keeps the product demoable to someone who has not installed
 * Nightly, and makes an analysis shareable by URL (`/?address=…`).
 */

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { Eye } from "lucide-react";
import { Button, Input } from "@/components/ui/primitives";

export function WatchInput({
  onWatch,
  compact = false,
}: {
  onWatch: (address: string) => void;
  compact?: boolean;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    try {
      // Validate before navigating so a typo fails here, not against the RPC.
      new PublicKey(trimmed);
      setError(null);
      onWatch(trimmed);
    } catch {
      setError("That is not a valid Cookie Chain address.");
    }
  };

  return (
    <form onSubmit={submit} className="w-full">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Inspect any Cookie Chain address…"
          className="font-mono text-xs"
          aria-label="Cookie Chain address to inspect"
          spellCheck={false}
          autoComplete="off"
        />
        <Button type="submit" variant={compact ? "secondary" : "primary"} disabled={!value.trim()}>
          <Eye className="h-4 w-4" />
          <span className={compact ? "sr-only" : ""}>Inspect</span>
        </Button>
      </div>
      {error ? (
        <p className="mt-1 text-xs" style={{ color: "var(--neg)" }} role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
