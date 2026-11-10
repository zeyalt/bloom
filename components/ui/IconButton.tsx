"use client";

import { forwardRef } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: LucideIcon;
  /** Accessible name — required, since the button shows no text. */
  label: string;
  tone?: "default" | "danger";
}

/** A 48×48 tap target with its icon centred in a 24×24 box. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, tone = "default", className, type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center w-12 h-12 shrink-0 cursor-pointer rounded-[var(--radius-md)]",
        "text-[var(--ink-soft)] disabled:opacity-40 disabled:cursor-default",
        tone === "danger" ? "hover:text-[var(--margin)]" : "hover:text-[var(--ink)] hover:bg-[var(--bg-secondary)]",
        className
      )}
      {...props}
    >
      <span className="w-6 h-6 flex items-center justify-center" aria-hidden="true"><Icon size={20} /></span>
    </button>
  );
});
