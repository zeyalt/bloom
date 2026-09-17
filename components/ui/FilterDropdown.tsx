"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
  /** Optional swatch shown beside the label, e.g. a child's colour code. */
  colorCode?: string;
}

/**
 * Shared shell for the filter dropdowns — pill trigger on the 40px control
 * baseline, chevron that flips when open, and a floating panel. `SingleSelect`
 * and `MultiSelect` both build on it so a filter row reads as one set of
 * controls regardless of how many values each takes.
 *
 * The panel renders in a portal: these controls sit in horizontally scrollable
 * filter rows, and `overflow-x` there would otherwise clip it.
 */
function DropdownShell({
  label,
  ariaLabel,
  className,
  children,
}: {
  label: string;
  ariaLabel: string;
  className?: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /** Where the fixed panel should sit, measured from the trigger. */
  function measure() {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return null;
    const top = box.bottom + 8;
    return {
      top,
      left: box.left,
      width: box.width,
      // Never run past the bottom of the window on short viewports.
      maxHeight: Math.min(288, window.innerHeight - top - 16),
      triggerVisible: box.bottom > 0 && box.top < window.innerHeight,
    };
  }

  function toggleOpen() {
    const m = measure();
    if (m) setAnchor(m);
    setOpen(o => !o);
  }

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!ref.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // The panel is fixed-positioned, so scrolling or resizing moves the trigger out
    // from under it. Follow the trigger rather than closing; give up only once the
    // trigger itself has left the viewport.
    const reposition = () => {
      const m = measure();
      if (!m || !m.triggerVisible) setOpen(false);
      else setAnchor(m);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={toggleOpen}
        className="flex items-center w-full h-10 pl-3.5 pr-9 text-sm text-left rounded-[var(--radius-md)] border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] cursor-pointer focus:outline-none focus:border-[var(--stem)]"
      >
        <span className="truncate">{label}</span>
      </button>
      <ChevronDown
        size={16}
        className={cn(
          "pointer-events-none absolute right-3.5 top-5 -translate-y-1/2 text-[var(--text-muted)] transition-transform",
          open && "rotate-180"
        )}
      />

      {open && anchor && createPortal(
        <div
          ref={panelRef}
          role="listbox"
          style={{ top: anchor.top, left: anchor.left, minWidth: anchor.width, maxHeight: anchor.maxHeight }}
          // A always-visible slim scrollbar: macOS overlay scrollbars render
          // nothing until you scroll, which makes a long list look truncated.
          className="fixed z-50 w-max overflow-y-auto p-1 rounded-[var(--radius-md)] border border-[var(--rule)] bg-[var(--sheet)] [scrollbar-width:thin] [scrollbar-color:var(--rule)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-[var(--rule)]"
        >
          {children(() => setOpen(false))}
        </div>,
        document.body
      )}
    </div>
  );
}

const optionRow =
  "flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-left text-[var(--text-primary)] cursor-pointer hover:bg-[var(--bg-secondary)]";

/** Single-value filter dropdown. Picking an option closes the panel. */
export function SingleSelect({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  const label = options.find(o => o.value === value)?.label ?? options[0]?.label ?? "";

  return (
    <DropdownShell label={label} ariaLabel={ariaLabel} className={className}>
      {close => options.map(opt => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="option"
            aria-selected={selected}
            onClick={() => { onChange(opt.value); close(); }}
            className={optionRow}
          >
            <span className="w-3.5 shrink-0 text-[var(--accent-primary)]">
              {selected && <Check size={14} />}
            </span>
            {opt.colorCode && (
              <span className="w-2 h-2 shrink-0" style={{ backgroundColor: opt.colorCode }} />
            )}
            <span className="whitespace-nowrap">{opt.label}</span>
          </button>
        );
      })}
    </DropdownShell>
  );
}

/** Multi-value filter dropdown. The panel stays open while toggling options. */
export function MultiSelect({
  options,
  selected,
  onToggle,
  allLabel,
  emptyLabel,
  pluralNoun,
  ariaLabel,
  className,
}: {
  options: FilterOption[];
  selected: string[];
  onToggle: (value: string) => void;
  /** Shown when every option is selected. */
  allLabel: string;
  /** Shown when nothing is selected. */
  emptyLabel: string;
  /** Used for the "3 Children" style summary. */
  pluralNoun: string;
  ariaLabel: string;
  className?: string;
}) {
  const label =
    selected.length === 0
      ? emptyLabel
      : selected.length === options.length
        ? allLabel
        : selected.length === 1
          ? options.find(o => o.value === selected[0])?.label ?? allLabel
          : `${selected.length} ${pluralNoun}`;

  return (
    <DropdownShell label={label} ariaLabel={ariaLabel} className={className}>
      {() => options.map(opt => {
        const checked = selected.includes(opt.value);
        return (
          <label key={opt.value} role="option" aria-selected={checked} className={optionRow}>
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(opt.value)}
              className="w-3.5 shrink-0 rounded cursor-pointer"
            />
            {opt.colorCode && (
              <span className="w-2 h-2 shrink-0" style={{ backgroundColor: opt.colorCode }} />
            )}
            <span className="whitespace-nowrap">{opt.label}</span>
          </label>
        );
      })}
    </DropdownShell>
  );
}
