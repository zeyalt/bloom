"use client";

// Drag a bottom sheet down by its handle or header to close it, as on Android and iOS.
// Touch and pen only (a mouse uses the X or the backdrop). Buttons inside still work.
import { useRef, useState, type CSSProperties, type PointerEvent } from "react";

const CLOSE_DISTANCE = 120; // px
const CLOSE_SPEED = 0.6; // px per ms: a quick flick closes it even if short

export function useSheetDrag(onClose: () => void) {
  const [dy, setDy] = useState(0);
  const start = useRef<{ y: number; t: number } | null>(null);

  const end = (e: PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const d = Math.max(0, e.clientY - s.y);
    const speed = d / Math.max(1, performance.now() - s.t);
    setDy(0);
    if (d > CLOSE_DISTANCE || (d > 24 && speed > CLOSE_SPEED)) onClose();
  };

  const handlers = {
    onPointerDown: (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      if ((e.target as Element).closest("button, a, input, select, textarea")) return;
      start.current = { y: e.clientY, t: performance.now() };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: PointerEvent) => {
      if (start.current) setDy(Math.max(0, e.clientY - start.current.y));
    },
    onPointerUp: end,
    onPointerCancel: end,
  };

  // Follow the finger while dragging; spring back (or away) when let go.
  const style: CSSProperties = dy
    ? { transform: `translateY(${dy}px)`, transition: "none" }
    : { transition: "transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1)" };

  return { handlers, style, dragging: dy > 0 };
}
