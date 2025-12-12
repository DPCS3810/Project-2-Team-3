import type { ReactNode } from "react";

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`tva-panel ${className}`}>{children}</div>;
}

export function PanelHeader({ title, actions }: { title: ReactNode; actions?: ReactNode }) {
  return (
    <div className="tva-panel__header">
      <div className="tva-panel__title">{title}</div>
      {actions ? <div className="tva-panel__actions">{actions}</div> : null}
    </div>
  );
}

export function PanelBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`tva-panel__body ${className}`}>{children}</div>;
}
