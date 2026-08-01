# Attendance data-layer optimisation (items 1, 2, 4)

Baseline: `/api/attendance-logs?limit=all` = 513 KB for 363 rows, fetched under
4 separate React Query keys (home, journal, attendance, analytics).

## Plan

- [x] **1. Slim the payload** — drop `include: { activity: { category }, child }`
      from the attendance-logs GET so it returns scalars only. Skip the redundant
      `count` query when `limit=all` (row count is the array length).
- [x] **2. One canonical query** — `useAttendanceLogs` fetches all logs once under
      a single key `["attendance-logs"]`, then filters (`from`/`to`/`childId`/
      `activityId`/`limit`) client-side. It re-hydrates `log.activity` and
      `log.child` from the already-cached `activities` / `children` queries, so
      every consumer's `log.activity?.activity_name` etc. keeps working unchanged.
      `isLoading` folds in the lookup queries so rows never render un-joined.
- [x] **4. Narrow invalidations** — saving an attendance log invalidates only
      `["attendance-logs"]`, not children + activities + schedules too.

## Verification

- [x] Payload: **513 KB → 202 KB** for the same 364 rows
- [x] `tsc --noEmit` clean, production build clean
- [x] Headless run of home / attendance / journal / analytics / expenses:
      all render, no console errors, "Showing 1–30 of 364 records" unchanged,
      joined names (`Speedcubing`, `Soccer`) and category groupings
      (`Hobby`, `Sports`, `Tuition`, `Religious Class`) intact
- [x] Clicking Attendance → Journal → Analytics fires **zero** attendance /
      children / activities requests (all cache hits); only `/api/expenses`
      loads, for Analytics

## Review

Three files changed:

- `app/api/attendance-logs/route.ts` — GET returns scalars only; the `count`
  query is skipped when the result set is already complete.
- `lib/api-hooks.ts` — new private `useAllAttendanceLogs` holds the one shared
  cache entry; `useAttendanceLogs` keeps its old signature but now filters that
  set in a `useMemo` and re-attaches `activity` / `child` from the existing
  caches, so no consumer changed. `isLoading` folds in those lookup queries.
- `app/page.tsx`, `app/attendance/page.tsx` — `fetchData`/`fetchAll` split into
  `refetchLogs` / `refetchSchedules`, each invalidating only its own key.

Behaviour notes: `limit` now counts post-filter from the newest log (was a
server-side `take` before the client filtered), which matches every caller's
intent. Analytics' "full history" timeline is now genuinely uncapped rather
than capped at 500.

---

# Follow-up pass (items 5, 6)

- [x] **5. Memoise the list pages** — attendance, expenses, journal and home
      re-derive their filtered/sorted/grouped views on every render (including
      every keystroke and every unrelated state change). Wrap the derivations in
      `useMemo` keyed on the data + filter state.
- [x] **6. Lazy-load recharts (404 KB)** — move the analytics page body into
      `components/analytics/AnalyticsDashboard.tsx` and have the route load it
      via `next/dynamic` with `ssr: false` plus a skeleton, so the chart library
      leaves the route's initial JS and the page shell paints first.

## Verification

- [x] `tsc --noEmit` + production build clean; eslint problems on the touched
      files went 32 → 28 (all remaining ones pre-existing)
- [x] Analytics initial JS: **1098 KB → 681 KB** across 11 → 10 chunks; the
      401 KB recharts chunk is no longer in the route's initial set
- [x] Headless pass over a production build (home, attendance, journal,
      analytics, expenses, settings): no console errors, "Showing 1–30 of 364
      records" unchanged, analytics KPIs identical ($4,448.82 / 96% / 164
      sessions / 275.8h), 16 charts drawn, page header rendered exactly once
- [x] Four client-side tab switches fire a single API call (`/api/expenses`)

## Review (items 5, 6)

- `app/attendance/page.tsx` — cascading filter options, the filtered set and the
  sort each moved into `useMemo`; `activityLabel` and `sortValue` hoisted to
  module scope (pure, and `sortValue` no longer needs the children array now
  that `log.child` is joined by the hook).
- `app/page.tsx` — `range`/`week` memoised on `weekOffset`, and the agenda build
  (`logsByKey` + `dayBlocks` + `adhocByDay`) collapsed into one `useMemo`; the
  now-unused `childMatch` helper removed.
- `app/journal/page.tsx` — activity-scope set and the month grouping memoised.
- `app/expenses/page.tsx` — child/payer filter and the year total memoised, so
  typing in the expense form no longer re-derives the table.
- `app/analytics/page.tsx` → `components/analytics/AnalyticsDashboard.tsx` — the
  680-line body moved wholesale (`git mv`, default export renamed); the route is
  now a thin shell that renders `Header` immediately and pulls the dashboard in
  via `next/dynamic` with `ssr: false` and the skeleton the page already had.
