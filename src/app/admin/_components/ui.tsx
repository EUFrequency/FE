import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-black/5 bg-white dark:border-white/5 dark:bg-white/[0.03] ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
        {children}
      </h2>
      {hint && (
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          {hint}
        </span>
      )}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const variants: Record<ButtonVariant, string> = {
    primary:
      "bg-amber-500 text-neutral-900 hover:bg-amber-400 disabled:bg-amber-500/40",
    secondary:
      "border border-black/10 text-neutral-700 hover:bg-black/5 dark:border-white/10 dark:text-neutral-200 dark:hover:bg-white/5",
    danger:
      "border border-red-500/30 text-red-600 hover:bg-red-500/10 dark:text-red-400",
    ghost:
      "text-neutral-500 hover:bg-black/5 dark:text-neutral-400 dark:hover:bg-white/5",
  };

  return (
    <button
      className={`inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "amber" | "green" | "red" | "sky" | "purple";
  children: ReactNode;
}) {
  const tones: Record<string, string> = {
    neutral:
      "bg-neutral-200 text-neutral-700 dark:bg-white/10 dark:text-neutral-300",
    amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    green: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    red: "bg-red-500/15 text-red-600 dark:text-red-400",
    sky: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    purple: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Label({
  children,
  hint,
  className = "",
}: {
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <span className={`text-xs text-neutral-500 dark:text-neutral-400 ${className}`}>
      {children}
      {hint && (
        <span className="ml-1 text-neutral-400 dark:text-neutral-500">
          {hint}
        </span>
      )}
    </span>
  );
}

export function Input({
  onFocus,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      onFocus={(e) => {
        // 숫자 입력칸은 클릭 시 기존 값을 전체 선택해 덮어쓰기 쉽게 함
        if (props.type === "number") e.target.select();
        onFocus?.(e);
      }}
      className={`h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm text-neutral-900 outline-none transition focus:border-amber-500/60 dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-100 ${props.className ?? ""}`}
    />
  );
}

export function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-amber-500/60 dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-100 ${props.className ?? ""}`}
    />
  );
}

export function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement>,
) {
  return (
    <select
      {...props}
      className={`h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm text-neutral-900 outline-none transition focus:border-amber-500/60 dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-100 ${props.className ?? ""}`}
    />
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-black/10 text-sm text-neutral-400 dark:border-white/10 dark:text-neutral-500">
      {children}
    </div>
  );
}
