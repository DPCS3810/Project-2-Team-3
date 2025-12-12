import type { ReactNode } from "react";
import { TVAButton } from "./Button";

export function TVAModal({
  open,
  title,
  children,
  onClose,
  footer,
}: {
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="tva-modal__backdrop">
      <div className="tva-modal">
        <div className="tva-modal__header">
          <div className="tva-modal__title">{title}</div>
          <TVAButton variant="ghost" onClick={onClose} aria-label="Close">
            ✕
          </TVAButton>
        </div>
        <div className="tva-modal__body">{children}</div>
        {footer ? <div className="tva-modal__footer">{footer}</div> : null}
      </div>
    </div>
  );
}
