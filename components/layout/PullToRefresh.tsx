"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

const THRESHOLD = 64;   // px of (damped) pull needed to trigger a refresh
const MAX = 96;         // the furthest the page follows the finger
const HOLD = 56;        // where it rests while refreshing
const MIN_SPIN = 600;   // keep the spinner up at least this long, so it reads as a refresh

/**
 * Pull-to-refresh for the app's scroll areas (anything marked `data-ptr-scroller`).
 * At the top of a page, dragging down pulls the page and a sprout badge in after the
 * finger; letting go past the threshold refetches every query on screen. It skips
 * dialogs and sideways swipes, and does nothing without touch. The drag runs on refs
 * and direct style writes so it never re-renders React mid-gesture.
 */
export function PullToRefresh({ containerRef }: { containerRef: React.RefObject<HTMLElement | null> }) {
  const queryClient = useQueryClient();
  const badgeRef = useRef<HTMLDivElement>(null);
  const sproutRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = containerRef.current;
    const badge = badgeRef.current;
    const sprout = sproutRef.current;
    if (!root || !badge || !sprout) return;

    let startX = 0, startY = 0, dist = 0;
    let scroller: HTMLElement | null = null;
    let mode: "idle" | "deciding" | "pulling" | "refreshing" = "idle";

    const paint = (d: number, animate: boolean) => {
      const t = animate ? "transform 0.25s cubic-bezier(0.2, 0.7, 0.3, 1), opacity 0.25s" : "none";
      if (scroller) { scroller.style.transition = t; scroller.style.transform = d ? `translateY(${d}px)` : ""; }
      const p = Math.min(1, d / THRESHOLD);
      badge.style.transition = t;
      badge.style.opacity = String(p);
      badge.style.transform = `translate(-50%, ${d - 48}px)`;
      sprout.style.transform = `scale(${0.5 + p * 0.5}) rotate(${(1 - p) * -30}deg)`;
    };
    const reset = () => {
      paint(0, true);
      badge.classList.remove("ptr-refreshing");
      const s = scroller;
      window.setTimeout(() => { if (s && mode === "idle") { s.style.transition = ""; s.style.transform = ""; } }, 260);
      mode = "idle";
    };

    const onStart = (e: TouchEvent) => {
      if (mode !== "idle" || e.touches.length !== 1) return;
      const target = e.target as HTMLElement;
      if (target.closest('[role="dialog"], input, textarea, select')) return;
      const s = target.closest<HTMLElement>("[data-ptr-scroller]");
      if (!s || s.scrollTop > 0) return;
      scroller = s;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dist = 0;
      mode = "deciding";
    };

    const onMove = (e: TouchEvent) => {
      if (mode !== "deciding" && mode !== "pulling") return;
      const dx = e.touches[0].clientX - startX, dy = e.touches[0].clientY - startY;
      if (mode === "deciding") {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        // Sideways (a scrolling strip) or upward (normal scrolling): not ours.
        if (Math.abs(dx) > Math.abs(dy) || dy < 0 || (scroller?.scrollTop ?? 1) > 0) { mode = "idle"; return; }
        mode = "pulling";
      }
      e.preventDefault(); // stop the native bounce while we drive the pull
      dist = Math.min(MAX, Math.max(0, dy) * 0.5);
      paint(dist, false);
    };

    const onEnd = async () => {
      if (mode === "deciding") { mode = "idle"; return; }
      if (mode !== "pulling") return;
      if (dist < THRESHOLD) { reset(); return; }
      mode = "refreshing";
      paint(HOLD, true);
      badge.classList.add("ptr-refreshing");
      navigator.vibrate?.(10);
      const started = Date.now();
      try {
        await queryClient.refetchQueries({ type: "active" });
      } finally {
        await new Promise(r => setTimeout(r, Math.max(0, MIN_SPIN - (Date.now() - started))));
        mode = "idle";
        reset();
      }
    };

    root.addEventListener("touchstart", onStart, { passive: true });
    root.addEventListener("touchmove", onMove, { passive: false });
    root.addEventListener("touchend", onEnd);
    root.addEventListener("touchcancel", onEnd);
    return () => {
      root.removeEventListener("touchstart", onStart);
      root.removeEventListener("touchmove", onMove);
      root.removeEventListener("touchend", onEnd);
      root.removeEventListener("touchcancel", onEnd);
    };
  }, [containerRef, queryClient]);

  return (
    <div
      ref={badgeRef}
      aria-hidden="true"
      className="ptr-badge pointer-events-none absolute left-1/2 top-0 z-30 w-10 h-10 rounded-full bg-[var(--sheet)] border border-[var(--rule)] shadow-[0_2px_8px_rgba(26,44,34,0.15)] flex items-center justify-center"
      style={{ opacity: 0, transform: "translate(-50%, -48px)" }}
    >
      <span ref={sproutRef} className="ptr-sprout block w-[14px] h-6 bg-[url(/splash/sprout.png)] bg-contain bg-center bg-no-repeat" />
    </div>
  );
}
