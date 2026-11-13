"use client";

// A short message at the bottom of the screen, with an optional action ("Undo"). It's how
// Android confirms a quick change: no dialog to dismiss, and mistakes are one tap to undo.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

interface SnackOptions {
  message: string;
  action?: { label: string; onClick: () => void | Promise<unknown> };
  /** How long it stays, in ms (default 5 s; longer with an action, so there's time to tap it). */
  duration?: number;
}
type Snack = SnackOptions & { id: number };

const SnackbarContext = createContext<(s: SnackOptions) => void>(() => {});

export const useSnackbar = () => useContext(SnackbarContext);

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [snack, setSnack] = useState<Snack | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const nextId = useRef(0);

  const show = useCallback((s: SnackOptions) => {
    window.clearTimeout(timer.current);
    const id = ++nextId.current;
    setSnack({ ...s, id });
    timer.current = window.setTimeout(() => setSnack(cur => (cur?.id === id ? null : cur)), s.duration ?? (s.action ? 6000 : 4000));
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <SnackbarContext.Provider value={show}>
      {children}
      {/* Above the phone tab bar (56px) and the safe area; bottom-left on wide screens. */}
      <div aria-live="polite" role="status"
        className="pointer-events-none fixed inset-x-0 z-[70] flex justify-center px-4 bottom-[calc(72px+env(safe-area-inset-bottom))] md:bottom-6 md:justify-start md:left-56">
        {snack && (
          <div key={snack.id}
            className="settings-backdrop pointer-events-auto flex items-center gap-2 min-h-12 max-w-md w-full md:w-auto pl-4 pr-2 py-1 rounded-[var(--radius-md)] bg-[var(--ink)] text-[var(--sheet)] shadow-[0_6px_20px_rgba(26,44,34,0.25)]">
            <span className="flex-1 text-sm leading-5 py-2">{snack.message}</span>
            {snack.action && (
              <button type="button"
                onClick={() => { const a = snack.action!; setSnack(null); void a.onClick(); }}
                className="shrink-0 h-10 px-3 rounded-[var(--radius-md)] text-sm font-bold text-[#9fd8b4] active:bg-white/10 cursor-pointer">
                {snack.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </SnackbarContext.Provider>
  );
}
