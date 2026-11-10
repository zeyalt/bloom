"use client";

import { cn } from "@/lib/utils";

/*
 * Bloom's page skeleton. Every screen is built from these, top to bottom:
 *
 *   <Page>
 *     <Header … />              1. fixed-height title row, icon-only actions
 *     <Utilities>…</Utilities>  2. child pills → tab switch → filters (12px apart)
 *     <PageBody>…</PageBody>    3–5. summary → primary element → feed (24px apart)
 *     <Fab … />                 6. floating create button (optional)
 *   </Page>
 *
 * One max width and one gutter for every screen, so titles, pills and content
 * edges sit on the same vertical lines whichever tab is open.
 */

/** Horizontal gutter shared by every block on every screen: 16px phone, 32px desktop. */
export const GUTTER = "px-4 md:px-8";

export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("max-w-[1200px] mx-auto w-full", className)}>{children}</div>;
}

/** Row 2: child pills, then the tab switch, then filter fields — always in that order. */
export function Utilities({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn(GUTTER, "flex flex-col gap-3 pb-6", className)}>{children}</div>;
}

/**
 * Rows 3–5. Sections are 24px apart. The bottom padding clears the tab bar and
 * the floating button on phones (56 nav + 16 + 56 FAB + 16) and the FAB on desktop.
 */
export function PageBody({ children, className, clear = "fab" }: {
  children: React.ReactNode;
  className?: string;
  /** What the bottom padding clears: the tab bar + FAB (default), or just the tab bar. */
  clear?: "fab" | "nav";
}) {
  return (
    <div className={cn(
      GUTTER, "flex flex-col gap-6",
      clear === "fab" ? "pb-[calc(144px+env(safe-area-inset-bottom))] md:pb-28" : "pb-[calc(80px+env(safe-area-inset-bottom))] md:pb-12",
      className
    )}>
      {children}
    </div>
  );
}

/** A section heading — the one style used for every content group. */
export function SectionHeading({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <h2 id={id} className={cn("text-base leading-6 font-semibold text-[var(--ink)] m-0", className)}>
      {children}
    </h2>
  );
}
