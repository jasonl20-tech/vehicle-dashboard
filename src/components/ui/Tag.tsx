import { type ReactNode } from "react";

type Variant = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

const STYLES: Record<Variant, string> = {
  neutral: "bg-ink-100 text-ink-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-rose-50 text-rose-700",
  info: "bg-sky-50 text-sky-700",
  brand: "bg-brand-50 text-brand-700",
};

export default function Tag({
  children,
  variant = "neutral",
}: {
  children: ReactNode;
  variant?: Variant;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${STYLES[variant]}`}
    >
      {children}
    </span>
  );
}
