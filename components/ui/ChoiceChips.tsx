"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A row of 40px choice chips with a "+ Add other" field — used for lesson type,
 * sender, fetcher and cancellation reason. Single-choice by default (tapping the
 * selected chip clears it); `multiple` lets several be on at once. Values that
 * aren't in `options` (typed in, or saved earlier) show as extra selected chips.
 */
export function ChoiceChips({
  options, value, onChange, multiple = false, ariaLabel,
}: {
  options: readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
  multiple?: boolean;
  ariaLabel: string;
}) {
  const [custom, setCustom] = useState("");
  const chips = [...options, ...value.filter(v => !options.includes(v))];

  function toggle(opt: string) {
    const on = value.includes(opt);
    if (multiple) onChange(on ? value.filter(v => v !== opt) : [...value, opt]);
    else onChange(on ? [] : [opt]);
  }
  function addCustom() {
    const v = custom.trim();
    setCustom("");
    if (!v || value.includes(v)) return;
    onChange(multiple ? [...value, v] : [v]);
  }

  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap items-center gap-2">
      {chips.map(opt => {
        const on = value.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(opt)}
            className={cn(
              "relative h-10 px-3 text-sm font-medium border cursor-pointer",
              "before:absolute before:inset-x-0 before:top-1/2 before:h-12 before:-translate-y-1/2 before:content-['']",
              on ? "bg-[var(--ink)] text-[var(--sheet)] border-[var(--ink)]" : "bg-[var(--sheet)] text-[var(--ink-soft)] border-[var(--rule)]"
            )}
          >
            {opt}
          </button>
        );
      })}
      <input
        type="text"
        value={custom}
        onChange={e => setCustom(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
        onBlur={addCustom}
        placeholder="+ Add other"
        aria-label={`${ariaLabel}: add other`}
        className="w-28 h-10 px-3 text-sm border border-dashed border-[var(--rule)] bg-[var(--sheet)] focus:outline-none focus:border-[var(--stem)]"
      />
    </div>
  );
}
