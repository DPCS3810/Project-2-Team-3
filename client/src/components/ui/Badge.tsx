import type { ReactNode } from "react";

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warn" | "error" }) {
  return <span className={`tva-badge tva-badge--${tone}`}>{children}</span>;
}
