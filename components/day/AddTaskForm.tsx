"use client";

import { useId, useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OneOffTask } from "@/lib/types";

const TIERS: { tier: OneOffTask["tier"]; label: string }[] = [
  { tier: "must", label: "Do first" },
  { tier: "practice", label: "Hobby" },
  { tier: "free", label: "Free Play" },
];

/**
 * "Add a task" for one child on the day shown: a one-off ("Pack swimming bag") that
 * appears on Home and the tablet for that date only.
 */
export function AddTaskForm({ childName, onAdd }: {
  childName: string;
  onAdd: (title: string, tier: OneOffTask["tier"]) => Promise<void>;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [tier, setTier] = useState<OneOffTask["tier"]>("must");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const close = () => { setOpen(false); setTitle(""); setTier("must"); setError(""); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await onAdd(title.trim(), tier);
      close();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 h-11 -ml-1 px-1 text-sm font-semibold text-[var(--stem)] hover:underline cursor-pointer">
        <Plus size={16} aria-hidden="true" /> Add a task
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 py-2">
      <div>
        <label htmlFor={`${id}-title`} className="block text-xs font-medium text-[var(--ink-soft)] mb-1">
          A task for {childName}, just this day
        </label>
        <input id={`${id}-title`} autoFocus value={title} maxLength={255} onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Pack swimming bag" enterKeyHint="done"
          className="w-full px-3 py-2 text-base md:text-sm border border-[var(--rule)] rounded-[var(--radius-md)] bg-[var(--sheet)] focus:outline-none focus:border-[var(--stem)]" />
      </div>
      <div role="group" aria-label="Where it goes" className="grid grid-cols-3 gap-2">
        {TIERS.map(t => (
          <button key={t.tier} type="button" aria-pressed={tier === t.tier} onClick={() => setTier(t.tier)}
            className={cn("h-11 px-2 text-sm font-medium rounded-[var(--radius-md)] border cursor-pointer transition-colors duration-150",
              tier === t.tier ? "bg-[var(--stem)] border-[var(--stem)] text-[var(--sheet)]" : "bg-[var(--sheet)] border-[var(--rule)] text-[var(--ink)]")}>
            {t.label}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="text-sm text-[var(--margin)]">{error} Try again.</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={close}
          className="h-11 px-4 text-sm font-medium rounded-[var(--radius-md)] border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] cursor-pointer">
          Cancel
        </button>
        <button type="submit" disabled={!title.trim() || busy}
          className="h-11 px-4 text-sm font-semibold rounded-[var(--radius-md)] bg-[var(--stem)] text-[var(--sheet)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
          {busy ? "Adding…" : "Add"}
        </button>
      </div>
    </form>
  );
}
