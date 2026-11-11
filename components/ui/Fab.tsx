"use client";

import { createContext, useContext } from "react";
import { createPortal } from "react-dom";
import { Plus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Inside a dialog (Settings), the button docks in the dialog's own corner instead of
 * the screen's: the dialog provides an element here and the button is portalled into it.
 */
export const FabSlot = createContext<HTMLElement | null>(null);

/**
 * The floating create button — one per screen at most, always in the same spot:
 * 16px from the right edge and 16px above the tab bar on phones, 32px in from the
 * corner on desktop. Lives inside its tab, so it hides with the tab.
 */
export function Fab({ label, onClick, icon: Icon = Plus }: { label: string; onClick: () => void; icon?: LucideIcon }) {
  const slot = useContext(FabSlot);
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "w-14 h-14 rounded-full bg-[var(--ink)] text-[var(--sheet)] flex items-center justify-center cursor-pointer shadow-[0_4px_12px_rgba(26,44,34,0.25)] hover:bg-[var(--stem)] active:scale-95",
        slot
          ? "pointer-events-auto"
          : "fixed z-40 right-4 bottom-[calc(72px+env(safe-area-inset-bottom))] md:right-8 md:bottom-8"
      )}
    >
      <span className="w-6 h-6 flex items-center justify-center" aria-hidden="true"><Icon size={24} /></span>
    </button>
  );
  return slot ? createPortal(button, slot) : button;
}
