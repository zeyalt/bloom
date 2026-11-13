"use client";

import { useEffect, useId } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBackToClose } from "@/lib/use-back-to-close";
import { useSheetDrag } from "@/lib/use-sheet-drag";
import { IconButton } from "./IconButton";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  /** Phones: fill the screen (for long forms) instead of a bottom sheet. */
  fullScreenOnPhone?: boolean;
}

const sizeStyles = {
  sm: "md:max-w-sm",
  md: "md:max-w-lg",
  lg: "md:max-w-2xl",
};

/**
 * Phones: a bottom sheet with a handle; drag it down, tap outside or use Back to close.
 * Long forms can fill the screen instead. Tablets and desktop: a centred dialog.
 */
export function Modal({ open, onClose, title, children, size = "md", fullScreenOnPhone = false }: ModalProps) {
  const titleId = useId();
  const drag = useSheetDrag(onClose);
  useBackToClose(open, onClose);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center md:p-4">
      <div className="settings-backdrop absolute inset-0 bg-[var(--ink)]/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={fullScreenOnPhone ? undefined : drag.style}
        className={cn(
          "settings-panel relative w-full flex flex-col bg-[var(--sheet)] border border-[var(--rule)]",
          fullScreenOnPhone
            ? "h-[100dvh] border-0"
            : "max-h-[92dvh] rounded-t-[16px] border-b-0 pb-[env(safe-area-inset-bottom)]",
          "md:h-auto md:max-h-[90dvh] md:rounded-[var(--radius-lg)] md:border md:pb-0",
          sizeStyles[size]
        )}
      >
        <div {...(fullScreenOnPhone ? {} : drag.handlers)} className="shrink-0 touch-none md:touch-auto">
          {!fullScreenOnPhone && (
            <div className="md:hidden flex justify-center pt-2" aria-hidden="true">
              <span className="w-10 h-1 rounded-full bg-[var(--rule)]" />
            </div>
          )}
          <div className={cn("flex items-center justify-between px-4 md:px-6 border-b border-[var(--rule)]",
            fullScreenOnPhone ? "h-14 pt-[env(safe-area-inset-top)] box-content md:pt-0 md:h-16" : "h-14 md:h-16")}>
            <h2 id={titleId} className="font-semibold text-[var(--ink)]">{title}</h2>
            <IconButton icon={X} label="Close" onClick={onClose} className="-mr-3" />
          </div>
        </div>
        <div className="overflow-y-auto overscroll-contain flex-1 px-4 py-5 md:px-6 md:py-6">{children}</div>
      </div>
    </div>
  );
}
