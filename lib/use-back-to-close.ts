"use client";

// Android's back gesture (and the browser Back button) should close whatever sheet or dialog
// is on top, not leave the screen. Each open layer adds one history entry at the same URL;
// Back pops it and closes the top layer only. Closing by other means (X, Save, backdrop)
// removes the entry again, so Back afterwards behaves as before.
//
// Entries are counted here rather than tagged: Next.js rewrites history.state with its own
// router data, so a marker on the entry doesn't survive.
import { useEffect, useRef } from "react";

type Layer = { close: () => void };
const layers: Layer[] = [];
let ignorePops = 0; // pops we caused ourselves while tidying up after a close
let listening = false;

function onPopState() {
  if (ignorePops > 0) { ignorePops--; return; }
  layers.pop()?.close();
}

export function useBackToClose(open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    if (!listening) { window.addEventListener("popstate", onPopState); listening = true; }
    let layer: Layer | null = null;
    // Deferred a tick, so React's dev-mode double effect doesn't push and pop an entry.
    const t = window.setTimeout(() => {
      // Same URL, Next's own state kept (without it, its router treats Back as a reload).
      window.history.pushState(window.history.state, "");
      layer = { close: () => closeRef.current() };
      layers.push(layer);
    }, 0);
    return () => {
      window.clearTimeout(t);
      if (!layer) return;
      const i = layers.indexOf(layer);
      if (i === -1) return; // already closed by Back
      layers.splice(i, 1);
      ignorePops++;
      window.history.back();
    };
  }, [open]);
}
