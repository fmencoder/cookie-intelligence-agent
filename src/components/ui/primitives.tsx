/** Small shadcn-style primitives, hand-rolled to keep the bundle lean. */

import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // min-w-0 keeps a card from forcing its grid column wider than the
        // viewport when it holds a wide table or a long signature.
        "min-w-0 rounded-xl border bg-[var(--panel)] shadow-[var(--shadow)]",
        className,
      )}
      style={{ borderColor: "var(--border)" }}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pt-4 pb-3", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("text-sm font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("mt-0.5 text-xs", className)}
      style={{ color: "var(--muted)" }}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-5", className)} {...props} />;
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "active:scale-[0.98]",
        size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
        variant === "primary" &&
          "bg-[var(--accent)] text-white hover:brightness-110 shadow-sm",
        variant === "secondary" &&
          "border bg-[var(--panel-alt)] hover:bg-[var(--accent-soft)]",
        variant === "ghost" && "hover:bg-[var(--accent-soft)]",
        variant === "danger" && "bg-[var(--neg)] text-white hover:brightness-110",
        className,
      )}
      {...props}
    />
  );
}

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "positive" | "negative" | "accent";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        className,
      )}
      style={{
        color:
          tone === "positive"
            ? "var(--pos)"
            : tone === "negative"
              ? "var(--neg)"
              : tone === "accent"
                ? "var(--accent)"
                : "var(--muted)",
        backgroundColor:
          tone === "accent" ? "var(--accent-soft)" : "transparent",
      }}
      {...props}
    />
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-lg border bg-[var(--panel-alt)] px-3 text-sm",
        "placeholder:text-[var(--muted)] disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse-soft rounded-md bg-[var(--accent-soft)]",
        className,
      )}
      {...props}
    />
  );
}

/** Accessible label for a metric tile. */
export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="min-w-0">
      <div
        className="text-[11px] font-medium uppercase tracking-wide"
        style={{ color: "var(--muted)" }}
      >
        {label}
      </div>
      <div
        className="mt-1 truncate text-xl font-semibold tabular-nums"
        style={{
          color:
            tone === "positive"
              ? "var(--pos)"
              : tone === "negative"
                ? "var(--neg)"
                : undefined,
        }}
      >
        {value}
      </div>
      {hint ? (
        <div className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}
