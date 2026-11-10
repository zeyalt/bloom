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

---

# Goals feature (per-child goals with timelines)

Prototype: https://claude.ai/artifact/H6Ms8NfeX9yoZ4XL2g6jiu

## Decisions (agreed)

- One feature, **Goals**, with two kinds. The UI and flow never branch on what a
  milestone is *about*; only Claude's wording differs.
  - **Milestone** — title + target date. Optional action plan of dated
    checkpoints (Claude-drafted or hand-written, always editable), tick
    checkpoints when hit, dated updates, mark achieved / reopen.
    Status: No plan yet · On plan · Behind plan (a checkpoint date passed
    unticked) · Overdue · Achieved.
  - **Measured** — metric (Height cm / Weight kg), target value + date, dated
    readings. Line chart: readings, planned path (first reading → target on the
    target date), trend projected to the target date, target line, today marker.
    Status: Needs 2 readings · On track · Behind trend · Achieved (auto when a
    reading reaches the target).
- Named **Goals** to stay distinct from the existing `milestones` table
  (activity gradings/achievements). No link between them in v1.
- New bottom-nav tab **Goals**; **Settings** moves to a header icon on mobile so
  the bar stays at five. Desktop sidebar keeps Settings.
- Stored in Supabase Postgres via Prisma like everything else. New tables only;
  no existing table changes.

## Plan

### 1. Data
- [x] Prisma models + migration `add_goals`:
  - `goals` — id, child_id → children, kind (`milestone`|`measured`), title,
    target_date DATE, achieved_date DATE?, unit?, target_value FLOAT?,
    created_at, updated_at
  - `goal_checkpoints` — id, goal_id → goals (cascade), due_date DATE, text,
    hit_date DATE?, sort_order INT
  - `goal_entries` — id, goal_id → goals (cascade), date DATE, note TEXT?,
    value FLOAT? (note for milestone updates, value for measured readings)
- [x] Types in `lib/types.ts` (`Goal`, `GoalCheckpoint`, `GoalEntry`)

### 2. API (same style as existing routes: prisma + `serialize`)
- [x] `GET/POST /api/goals` — list (with checkpoints + entries) / create.
      Creating a measured goal also writes its first reading.
- [x] `PATCH/DELETE /api/goals/[id]` — edit title/date/target, achieve/reopen, delete
- [x] `PUT /api/goals/[id]/plan` — replace all checkpoints in one transaction
      (used by Save in the plan editor; hit dates travel with each checkpoint)
- [x] `PATCH /api/goal-checkpoints/[id]` — tick / untick (hit_date)
- [x] `POST /api/goals/[id]/entries`, `PATCH/DELETE /api/goal-entries/[id]`
- [x] `POST /api/goals/[id]/draft-plan` `{ context? }` → Claude
      (`claude-sonnet-5-5`, same SDK as Journal Chat) returns
      `[{ due_date, text }]`. Prompt gets: goal title, child name + age (from
      `date_of_birth`), today, target date, checkpoints already hit, recent
      updates, parent's notes. Forced tool call for structured output; server
      validates (dates between today and target date, sorted, 2–8 items, last =
      target date). **Does not save** — fills the editor.

### 3. Client data
- [x] `useGoals()` + mutations in `lib/api-hooks.ts`, one `["goals"]` query key,
      invalidated on every write

### 4. UI (match prototype; Bloom tokens + Tailwind)
- [x] Nav: add Goals to `NAV_ITEMS` / `TAB_VIEWS` / `TAB_PATHS`; Settings icon in
      `Header` on mobile
- [x] `GoalsView` — child switcher, active goals sorted by target date, Achieved list
- [x] Goal detail route `app/goals/[id]` (like `app/activity/[id]`) →
      `GoalDetailView`
  - [x] Milestone: action-plan panel (prompt → drafting → editor → saved list
        with tick circles, Edit plan, Redraft with Claude, write-my-own),
        updates timeline + add update, mark achieved / reopen
  - [x] Measured: now / target / to-go tiles, `GoalChart` (plain SVG, no
        recharts, so no lazy loading needed), log reading, readings list with
        edit/delete
- [x] `GoalForm` sheet — new + edit (kind, title or metric, now/target, date);
      delete with confirm
- [x] Home: small "Goal checkpoints due this week" strip (due within 7 days or
      overdue and unticked), tap → goal

### 5. Nice-to-have (only if cheap)
- [x] Add the three tables to the Journal Chat `SCHEMA` so Chat can answer
      "how is the sleep goal going?"

## Verification
- [x] `tsc --noEmit`, `eslint`, `next build` clean
- [x] Playwright on iPhone 13 emulation against dev server: create a milestone
      goal → draft plan (real Claude call) → edit a date + wording → save →
      tick a checkpoint → add update → achieve; create a measured goal → log 2
      readings → chart renders with all four lines; reload → everything persists
- [x] Existing tabs unaffected (Home/History/Analytics/Journal render, no
      console errors); Settings reachable on mobile and desktop

## Review

- **Database** is Neon Postgres (not Supabase as first written). Migration
  `20261109120000_add_goals` was generated by diffing the live DB against the
  schema (only CREATE TABLE / INDEX / FK), applied with `prisma migrate deploy`.
- **Draft-plan route** uses `claude-opus-5-5` with structured output
  (`output_config.format` json_schema) — forced `tool_choice` returns 400 on this
  model — effort `medium`, and server-side refusal fallback to `claude-opus-4-8`.
  Real call: 5 dated checkpoints in ~5 s, last on the target date.
- **Verified** against a production build on :3011 (the dev server on :3000
  still has the old Prisma client loaded and needs a restart):
  - API: create/plan replace (sorted, hit dates kept)/tick/entries/validation errors
  - iPhone 13 emulation: Goals tab + gear → Settings; create measured goal, log
    2 back-dated readings → chart with readings/planned path/trend/target, "0.3 cm
    ahead", "On track"; milestone: edit plan + add checkpoint, Redraft with Claude
    (hit checkpoint kept), tick, add update, reload persists, achieve → reopen;
    Home strip lists a checkpoint due in 3 days and taps through; History /
    Analytics / Journal still render; desktop sidebar keeps Settings, gear hidden.
  - No console or page errors.
  - Fixed during testing: long goal titles truncated in the header (title now
    sits below it and wraps); "Hit" badge wrapping; checkpoint editor is a
    2-line textarea.
- Test goals deleted afterwards; the three tables are empty.
- Extra: Journal Chat's SQL schema now includes the goal tables.
- Pre-existing lint errors left alone (AppShell/spa-nav set-state-in-effect,
  HomeView no-children-prop).

---

# UI/UX consistency pass (design system + tab alignment)

Audit (iPhone 13, before): header title already identical (top 24, left 20).
Everything around it drifts — tab switches in 4 places/4 styles (History's in
the header truncates the title to "Hist…"); child pills at y≈124/135/140/180;
create actions in header / mid-page / toolbar; 13 different tappable heights
(15–56px); 20px gutter is off-scale.

## Decisions (agreed)
- Gutter **16px** phone, 32px desktop. Spacing only from the 4px scale
  (4/8/12/16/24/32/48) — no 6/10/14/20px.
- Sizes: **52px** primary buttons · **48px** inputs/selects · **40px**
  secondary buttons, pills, segmented tabs — every hit zone ≥ 48×48 ·
  icons in a 24×24 box.
- Create actions → one **floating + button** (56px round), bottom-right above
  the tab bar, same spot on every tab; tabs with nothing to create show none.

## Structure every screen follows (one `Page` component enforces it)
1. **Header** — fixed height; title + subtitle left; right slot holds only
   48×48 icon buttons (settings gear; Edit on detail pages). No text buttons
   or switches in the header.
2. **Utilities**, always in this order, 12px apart:
   a. child pills (same component everywhere; single-select variant on Goals)
   b. tab switch (one `Segmented` style: full width, 40px)
   c. filter fields (Year / Activity selects, 48px)
3. **Summary** (e.g. Home's not-logged card, History's record count)
4. **Primary element** (e.g. Home's week bar)
5. **Feed** — sections 24px apart, one heading style
6. **FAB** — fixed; content gets bottom padding so nothing hides under it

## Plan
- [x] Tokens in `globals.css` + Tailwind theme: spacing scale, control heights,
      gutter, type scale (title 28/32, section 16/24, body 14/20, meta 12/16)
- [x] `Page` layout (header + utilities + content + FAB slot) and `Header`
      with fixed height and icon-only actions; `IconButton` (48 hit / 24 icon)
- [x] Shared controls resized: `Button` (lg 52 / md 40), `Segmented` (40, full
      width), `ChildFilter` (40, + single-select mode), inputs/selects (48),
      `FilterBar`, `Fab`; bottom nav items 48×48 min, icon box 24, label centred
- [x] Move every tab onto `Page`: Home, Goals, History, Analytics, Journal,
      Settings, plus Activity and Goal detail pages
  - History: Sessions/Payments switch out of the header → utilities row
  - Settings: underline tabs → the shared `Segmented`
  - Home "Add event", Goals "New goal", History "+ Add" → FAB
    (Settings sub-tabs' add buttons → FAB too)
  - Goal detail "Edit" → pencil icon button
- [x] Sweep off-grid spacing (`*-1.5`, `*-2.5`, `*-3.5`, `*-5`) in views,
      modals and shared components onto the scale
- [x] Modals: inputs 48, footer buttons 52

## Verification
- [x] Measurement script on iPhone 13 + 1280px desktop, every tab: h1 top/left,
      header height, child-pill row top, tab-switch top, first filter top, FAB
      position, gutter left/right — must match **to the pixel** across tabs
      that share the element; every tappable ≥ 48×48 hit zone; no control
      heights outside {40, 48, 52, 56}
- [x] Side-by-side screenshots of all tabs before/after
- [x] tsc, eslint (new code), `next build`; no console errors

## Review

**Measured after (iPhone 13 and 1280px desktop, every tab):**
- Header 96px on every tab; title at (16, 24) on phones and x=240 on desktop
  (was: 7 different page widths, so desktop titles shifted per tab).
- Child pills at y=96 on Home / Goals / History / Analytics / Journal.
- Tab switch at y=148 on History / Analytics / Journal; y=96 on Settings
  (no pills there — the one intended difference).
- First filter at y=228; gear and FAB at identical coordinates.
- Every control in the content area passes a real tap test (elementFromPoint
  23px above/below/left/right of centre lands on the control). Exempt: the
  Analytics engagement-timeline marks (a chart, tagged `data-chart`).
- Dialog controls only 40 / 48 / 52px. No console or page errors.

**Built:** `Page` / `Utilities` / `PageBody` / `SectionHeading` (components/layout/Page.tsx),
fixed-height `Header` + `BackButton`, `IconButton` (48 / 24), `Fab`; `Button`
(52 default, 40 `sm`), `Segmented` (one switch everywhere), `ChildFilter`
(40px, `single` mode, prop renamed `childList`), 48px dropdown triggers and a
global 48px rule for text inputs/selects; bottom nav 56px items, 24px icon box,
safe-area padding.

**Found and fixed on the way:**
- Global h1/h2/h3 rules were unlayered, so they overrode every component's
  heading classes (titles rendered 24px, not the intended size). Moved to
  `@layer base` with one scale.
- Invisible 48px tap zones were clipped by `truncate` / `overflow-hidden`
  parents and measured 46px on bordered controls — now an exact 48px zone
  centred on the control, with clipping moved to inner spans.
- Home: a logged/unlogged row now has one 48px action; the recurring-slot
  delete moved inside the schedule editor.

**Lint:** no new findings; 5 pre-existing ones fixed (40 → 35, the rest predate this).

**Known limits:** Settings › Activities / Schedules keep their own per-child
tabs inside the content; Analytics charts' internal spacing (recharts) is
untouched beyond the sweep.
