"use client";

import { useEffect } from "react";

/**
 * App-like lockdown: blocks copy/cut/paste and the right-click/long-press
 * callout across the whole app, plus iOS Safari pinch-zoom gestures (which can
 * ignore the viewport `user-scalable=no` setting).
 */
export function InteractionLock() {
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    const events = ["copy", "cut", "paste", "contextmenu", "gesturestart", "gesturechange", "gestureend"];
    events.forEach(ev => document.addEventListener(ev, block));
    return () => events.forEach(ev => document.removeEventListener(ev, block));
  }, []);

  return null;
}
