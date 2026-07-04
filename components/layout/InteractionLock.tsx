"use client";

import { useEffect } from "react";

/**
 * App-like lockdown: blocks copy/cut/paste and the right-click/long-press
 * callout across the whole app, plus iOS Safari pinch-zoom gestures (which can
 * ignore the viewport `user-scalable=no` setting).
 */
export function InteractionLock() {
  useEffect(() => {
    // Allow copy/cut/paste and the callout inside editable fields; block elsewhere.
    const isEditable = (el: EventTarget | null) =>
      el instanceof HTMLElement &&
      (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    const blockClipboard = (e: Event) => { if (!isEditable(e.target)) e.preventDefault(); };
    const blockGesture = (e: Event) => e.preventDefault();

    const clipEvents = ["copy", "cut", "paste", "contextmenu"];
    const gestureEvents = ["gesturestart", "gesturechange", "gestureend"];
    clipEvents.forEach(ev => document.addEventListener(ev, blockClipboard));
    gestureEvents.forEach(ev => document.addEventListener(ev, blockGesture));
    return () => {
      clipEvents.forEach(ev => document.removeEventListener(ev, blockClipboard));
      gestureEvents.forEach(ev => document.removeEventListener(ev, blockGesture));
    };
  }, []);

  return null;
}
