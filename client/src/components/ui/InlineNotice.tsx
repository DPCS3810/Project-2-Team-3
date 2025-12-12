import type { ReactNode } from "react";

export function InlineNotice({ tone = "neutral", children }: { tone?: "neutral" | "warn" | "error" | "success"; children: ReactNode }) {
  return <div className={`tva-notice tva-notice--${tone}`}>{children}</div>;
}
