# My Day — phase 1 build plan

Branch `feature/my-day` · database: Neon branch `my-day` (a copy of production; `.env.local` points
at it, original saved as `.env.local.production-backup`). Prototype:
https://claude.ai/artifact/E4kQKDkti6xRrSMTsXxe7o

**Goal:** the kids open My Day on the tablet and can see, without being told, what to do now, what
comes next and when they're done. Parents set it up once in Settings and see progress on Home.

**Out of scope (later phases):** Google Calendar, the family snapshot (phase 3); ticks feeding
Goals evidence, Journal and Analytics streaks (phase 2); stars or rewards (decided: no).

## Decisions already made

- Kids use a **tablet**; Zara reads on her own; **ticks only**, no points; **kids tick** their own
  tasks and every tick records the **time**.
- School info is **entered in Settings**, never hard-coded: per child, with **per-weekday times**.
- Two routines per child: **School day** (with optional per-weekday tweaks) and **Holiday**.
- Fixed times such as dinner and bedtime are **set in Settings › Routines**, as timed rows that show
  on the timetable but aren't ticked. Nothing is hard-coded.
- Kids **can untick**, any time on the same day; the parent log updates to match.
- Test tool: **Vitest**, development only (approved).
- At merge, a script **copies the setup** from the `my-day` copy to production (approved).
- Where calendar dates come from (not Google):
  - MOE term and holiday dates, checked against MOE's published page and seeded for 2026–2027.
  - Singapore public holidays from data.gov.sg, with an "Import <year>" button for later years.
  - Your own days, added in Settings › Calendar.

## Data model (one Prisma migration)

- [x] `Child`: add `schoolLevel` (e.g. "Primary 2"), `autoPromote` (moves up each January) and
      `calendarId` (which school calendar they follow). `school` already exists.
- [x] `SchoolHours`: one row per child per weekday: `isSchoolDay`, `startTime`, `endTime`,
      `afterSchool` (free text, e.g. "CCA till 3:30 PM"). Unique on (child, weekday).
- [x] `SchoolCalendar`: `name`, `kind` (`moe_primary` | `custom`).
- [x] `CalendarDay`: `calendarId` (null = applies to everyone, e.g. public holidays),
      `startDate`, `endDate`, `kind` (`term` | `school_holiday` | `public_holiday` | `half_day` |
      `no_school`), `title`, `endsAt` (half days), `source` (`moe` | `data.gov.sg` | `you`).
- [x] `RoutineItem`: `childId`, `dayType` (`school` | `holiday` | `any`), `weekdays` (empty = every
      day of that type; otherwise only those days), `tier` (`must` | `practice` | `free` |
      `anchor`), `title`, `atTime` (anchors such as Dinner 6:30, which show only on the
      timetable), `sortOrder`.
- [x] `TaskTick`: `childId`, `date`, `itemKey` (`routine:<id>` | `prep:<activityId>` |
      `goal:<goalId>`), `title` and `tier` copied at tick time (so history survives edits),
      `doneAt` (a full timestamp). Unique on (child, date, item). A free-choice pick is a tick too
      ("started at").
- [x] Automatic items, with no table of their own:
  - `Activity.prepTask` (e.g. "Pack swimming kit") turns into a must-do on that class's days.
  - `Goal.practiceTask` and `Goal.practiceDays` (e.g. "Cube practice · 15 min", school days)
    turn into a practice item.
  - To hide one, clear the field; Routines links to where it's edited.
- [x] Seed: the MOE primary calendar for 2026 and 2027 (terms and school holidays) and Singapore
      public holidays. **Verify every date against MOE and data.gov.sg at build time**; nothing
      from memory.
- [x] "Import <year>" (the API; the button comes in stage 2) fetches that year's public holidays from data.gov.sg.
      Future MOE terms (published each year) are seeded or typed in: 4 terms, 8 dates.

## Core logic: `lib/my-day.ts` (pure functions, no database access)

- [x] `dayInfo(child, date, calendarDays, schoolHours)` returns `school` | `half_day` |
      `holiday`. The rules apply in order:
  1. A public holiday → holiday.
  2. A school holiday or no-school day in the child's calendar → holiday.
  3. A non-school weekday (weekends by default) → holiday.
  4. A half day → school, with that day's `endsAt`.
  5. Otherwise → school.
- [x] `buildDay(…)` returns the timetable blocks and the task list:
  - **Timetable:** school (start to end), "Home from school", classes from Schedules (respecting
    `isActive`, `effectiveFrom` and `effectiveUntil`), and anchors.
  - **Tasks:** routine items for the day type and weekday, plus class prep, plus goal practice,
    grouped as must / practice / free.
  - **Must-do deadline:** "before <first class after school>", or none.
  - **Now:** the first must-do not yet done, otherwise the first practice item not yet done.
- [x] Dates in Singapore time throughout. "Today" rolls over at midnight on a tablet that's left
      open (and on Home: a picked day lasts only the day it was picked, fixed in stage 6).
- [x] Tests for these rules with fixed dates: a school day, a half day, a public holiday, a school
      holiday, a weekend, a class with an end date, and a class prep that only shows on its day.
      Uses Vitest (approved).

## API routes (same patterns as the goals routes)

- [x] `/api/school-hours`: GET all; PUT a child's whole week in one call.
- [x] `/api/calendars`, `/api/calendar-days`: GET, plus create, update and delete for your own
      days. Seeded MOE and public-holiday rows are read-only.
- [x] `/api/routine-items`: GET, create, update, delete, and reorder.
- [x] `/api/ticks?date=&childId=`: GET; POST ticks an item (idempotent); DELETE unticks it.
- [x] Extend the activity and goal routes for `prepTask`, `practiceTask` and `practiceDays`.

## Settings (the Settings dialog)

- [x] **Children › Edit Child**: a School part with name, level, calendar, "moves up a level each
      January", a 7-row weekday table (school yes/no, start, end, after school) and "copy
      Monday's times to all school days".
- [x] **Calendar** (new section): a list of calendars, with "add a calendar" (custom), a Coming up
      list showing where each day came from, and "add a day off or half day".
- [x] **Routines** (new section):
  - Child pills, a School day / Holiday switch, and weekday chips.
  - Four groups: Fixed times (dinner, bedtime: a name and a time, for the timetable only), Must
    do, Then practise and Free choice.
  - Automatic rows are tagged ("Auto · from AQSA schedule", "Auto · from goal …") and link to
    their source.
  - Add with the + button, edit, delete, and drag to reorder (or up and down buttons on phones).
- [x] **Activities › edit**: a "Prep task" field. **Goal form**: "Daily practice" fields.

## My Day: the kid's tablet screen (`/my-day`)

- [x] Full screen, outside the app's normal frame: no sidebar, tab bar or Settings.
  - Child pills; the last child chosen is remembered on that tablet.
  - Layout: the timetable on the left; on the right, the Now card with the "I'm done" button, a
    progress bar, the Must do and Then practise lists, and the Free choice panel (locked until
    the must-dos are done).
  - An all-done state when everything is ticked.
- [x] Ticking saves at once, with a time stamp, and the screen updates before the server replies.
      Tapping a ticked task unticks it, and the parent log updates too.
- [x] Left open all day: the clock updates every minute, and the data refetches every 60 seconds,
      on focus and at midnight.
- [x] Its own home-screen install: a separate manifest whose start URL is `/my-day`, so the
      tablet's icon opens straight to it. The phone's Bloom icon is unchanged.
- [x] Tablet sizes: designed for landscape, with a stacked layout when the tablet is in portrait.
      Tap targets at least 56px.
- [ ] Known limit: Bloom has no login, so a curious kid could type another address. That's
      acceptable for a family tablet; a PIN for parent screens can come later if needed.

## Names the kids see (decided 12 Nov)

**Today** (timetable, set times) · **Do first** · **Hobby** · **Free Play** (locked until Do first
is done). The same words are used in Settings › Routines.

## Homework that carries over (decided 12 Nov, built in stage 3)

- [x] Switched on **per activity** (only parents): "Gives homework after each lesson", with an
      optional note (e.g. "Worksheet and spelling").
  - Stored as `activities.homework_from` (the date it was switched on, so past lessons don't
    flood in) and `activities.homework_note`.
- [x] Each lesson since then creates one homework item. It's worked out, not stored: lessons
      come from Schedules, and a lesson logged as **cancelled or absent** gives no homework.
- [x] Due **the day before the next lesson** (from the schedule). When no next lesson is
      scheduled (end of term), it's due 6 days after the lesson.
- [x] Shows every day until ticked; it doesn't reset at midnight. A tick is stored as
      `homework:<activityId>:<lessonDate>` and closes it for good, with the time.
- [x] On the tablet: "Chinese Tuition homework · from the 18 Jan lesson · due Sat 24 Jan".
  - Due **within 3 days**, or overdue: in **Do first**, so it blocks Free Play. Overdue gets a tag.
  - Due later: listed under Do first as "Not due yet". You can start early, and it doesn't block.
- [x] Parents only: on Home, mark a lesson's homework as "No homework this time"
      (`task_ticks.skipped`), or tick it done on the child's behalf.
- [x] Home › Kids today shows each child's open homework, and when each piece was finished.
- [x] Tests: due date from the next lesson (and with no next lesson); cancelled or absent lessons
      give none; the 3-day threshold; overdue; a tick closes it for good; lessons before
      `homework_from` are ignored.

## Home: the Kids today card (parent phone)

- [x] Above Today: one row per child with "x of y done", a progress bar and a hint ("2 must-dos
      left before AQSA at 4:00"). Tapping a child opens their log of ticks with times.
- [x] Hidden on days with no routine set up, so nothing changes for you until you configure it.

## Stage 5 plan: Home becomes a day view (agreed and built 12 Nov)

**Goal:** Home shows **one day at a time**, today by default. Everything for that day is on one
screen: school, classes (log attendance in place), fixed times, and each child's routine and
homework. A date bar moves to any past or future day. The kids' tablet (`/my-day`) is unchanged.

### Date bar (replaces the week picker)
- [x] ~~The chosen date lives in the URL~~ → changed: tab switches rewrite the URL, so the date is
      kept in memory (Home stays loaded between tabs) and in session storage, so refresh keeps it.
      It resets to today the next day.
- [x] A strip of the 7 days of that week (Sun–Sat, as now), with ‹ › for the previous or next
      week. Each day shows its letter and number; today is ringed and the chosen day filled.
- [x] Day markers: a dot if anything is planned; an amber number for past sessions not logged.
- [x] Tapping the month label opens a calendar to pick any date (past or future), plus a
      "Today" button. It replaces the "Choose a week" dialog.

### The day
- [x] Header line: "Thu 12 Nov · 2 classes, 1 to log" (or "No school · Deepavali").
- [x] "Not logged" reminder stays, per **day** instead of per week: "4 past sessions not logged"
      with a chip per day (oldest first, last 6 weeks); a chip jumps to that day.
- [x] Goal checkpoints due (today only, as now).
- [x] **Timeline** for all selected children, in time order:
  - School block per child ("Zayyan · School 7:20 AM – 1:40 PM", after-school activity, half
    days), fixed times (dinner, bedtime), and classes tagged with the child.
  - Today: "Now" / "Up next" marker, as now.
- [x] **Log attendance in place** on each class row:
  - One tap on Attended / Absent / Cancelled **saves straight away** (no form). Sender and
    fetcher are filled with the same guess the form uses today (moved into a shared helper).
  - The logged row then shows "Attended · Sent by Mum · Fetched by Dad"; tap sender or fetcher
    to change them in a small picker.
  - "Add reflection" opens a text box right under the row, saved with one button.
  - Absent asks for an optional reason in the same way.
  - The pencil still opens the full form for the rarer fields (lesson type, location, times).
- [x] **Routine card per child** (what the Kids today card shows, always open):
  - Do first, Hobby, Free Play picks and homework, each with the time ticked or "not yet".
  - Parents can tick or untick any item, not only homework. Homework keeps Mark done /
    No homework this time / Undo.
- [x] The + button adds an event on the **chosen** date.

### Past and future days
- [x] **Past:** attendance as now. Routine ticks can be added late; they're saved as
      **ticked by parent** and the time shown is when you ticked it, e.g. "ticked later by
      parent · Fri 9:14 PM". Homework shows only on today (it's about what's due now).
- [x] **Future:** classes and routines shown as the plan; routines can't be ticked yet.
      Marking a class Cancelled ahead of time still works, as now.

### Keeping each day's list (routine history)
- [x] New table `DayPlan` (child, date, list of items: key, title, tier, time). When today's
      routine is shown (Home or tablet), today's list is saved if it changed.
- [x] A past day uses its saved list; days before this feature fall back to today's routine.
      Ticks always keep their own title, so a removed item still shows as done.
- [x] `TaskTick` gets `by` (`child` | `parent`): the tablet saves `child`, Home saves `parent`.
- [x] One additive migration on the `my-day` copy only.

### Code shape
- [x] `useMyDays(now)` takes the chosen date: past days are built as "end of day", future as
      "start of day".
- [x] The Home page is split: `DateBar`, `DayTimeline`, `ClassRow` (inline logging) and
      `RoutineCard` (from `KidsTodayCard`, which goes away), so `HomeView` stays readable.
- [x] The week list and its helpers are removed; the not-logged count moves to per day.
- [x] Not changed: the tablet, Settings, Activities, Goals, Journal, Analytics.

### Tests and checks
- [x] Vitest: not-logged per day, past/future rules, a saved day list vs. today's routine,
      late parent ticks.
- [x] Playwright, iPhone 13 with taps: move days with the bar and the calendar; one-tap
      Attended, change the fetcher, add a reflection; tick a routine on a past day and see
      "ticked later by parent"; a future day can't be ticked; the tablet still matches.
- [x] `tsc`, tests, `next build`, no new lint errors; test data undone afterwards.

### Not in this stage
- A "Week" button to bring back the old list. Add it only if you miss the week view.
- Completion rates and streaks in Analytics (phase 2).

## Build order (I'll check in with you after each stage)

1. [x] Migration, seed and API routes, plus `lib/my-day.ts` with its tests.
2. [x] Settings: School in Edit Child, then Calendar, then Routines, prep task and goal practice.
       → *You set up Zayyan and Zara's real details from your phone.*
3. [x] My Day on the tablet. → *You try it on the real tablet.*
4. [x] The Kids today card on Home.
5. [x] Home becomes a day view (plan above). → *You try it on your phone.*
6. [x] Polish and the full verification pass (your real-device check still to do).

## Verification (before calling it done)

- [x] `tsc` passes, there are no new lint errors, and `next build` succeeds.
- [x] The rule tests pass for all the fixed dates above.
- [x] Playwright on iPhone 13 (parent screens) and a 1180×820 touch tablet (My Day), using taps
      rather than clicks:
  - Set up a child's school hours.
  - Add a half day.
  - Build a routine.
  - Tick tasks on My Day and see the times stamped, with Free choice unlocking.
  - See the same ticks on Home.
- [ ] Check on a real device over the hotspot (`http://<laptop IP>:3000`).
- [x] Existing screens are unchanged: Home, Goals, Journal, Analytics and Settings load with no
      console errors.

## When the feature is done: merging

- [ ] Ask you before committing or pushing anything.
- [ ] Merge `feature/my-day` into `main`, and run the migration on production
      (`prisma migrate deploy`).
- [ ] Re-enter the setup on production (school hours, routines), or copy those rows across from
      the `my-day` branch with a script.
- [ ] Switch `.env.local` back to production and delete the Neon `my-day` branch.

## Stage 1 review (12 Nov)

- **Migration** `20261112120000_my_day`, purely additive (5 new tables plus optional columns),
  applied to the `my-day` copy only. Generated with `migrate diff` + `migrate deploy`, because
  `migrate dev` can't replay an old migration on a shadow database. Production gets the same
  migration with `migrate deploy` at merge.
- **Calendar data** in `lib/calendar-sources.ts`, every date from a named source:
  - MOE 2026 (moe.gov.sg/calendar) and MOE 2027 (press release, 14 Jul 2026), including the
    days off-in-lieu and "P2–P6 start 5 Jan 2027".
  - Public holidays come live from data.gov.sg (MOM's yearly datasets), with a copy for 2026–27
    as a fallback.
  - Imported to the copy: 28 MOE rows and 26 public holidays. A second import made no duplicates.
- **Rules** in `lib/my-day.ts`: 23 Vitest tests pass, using the real data. They cover a school
  day, the Wednesday CCA and the Friday early finish, a half day, an observed public holiday, a
  day off-in-lieu, school holidays, weekends, 2027's P1-only first day, no hours entered, no
  calendar, a custom calendar with gaps, ticks from the wrong date, ended classes, weekday-only
  lines, and Free choice unlocking.
- **API** checked against the dev server:
  - Validation rejects bad times, a fixed time with no time, and a half day with no end.
  - Ticking twice keeps the first time; unticking twice is fine.
  - Imported days can't be edited.
  - Old edit forms leave the new fields alone.
  - Test rows were removed afterwards.
- `tsc` passes; no new lint errors (the one error in `app/api/activities/route.ts:14` was
  already there).

## Stage 2 review (12 Nov)

- **Edit Child › School:**
  - Level (stored with its year, so it moves up each January), "follows calendar" (choosing
    MOE when it isn't imported yet imports it first), and a 7-day hours editor (on/off, start,
    end, after-school note, and "copy Monday's times").
  - On phones, the times sit on their own line. The child row shows level and an hours summary.
- **Calendar section:**
  - Calendars, with who follows each. "Update holidays" re-imports this year and next, and says
    which years have no MOE dates in Bloom or no published public holidays.
  - Add or delete a custom calendar.
  - Coming up: holidays and days off, with each day's source. Days you added can be edited and
    removed.
  - The + button adds a day off, half day (with the end time), school holiday or term.
- **Routines section:**
  - Child pills, a School days / Holidays switch, and weekday chips that show that day's real
    list.
  - Four groups: Fixed times, Must do, Then practise, Free choice.
  - Up and down arrows to reorder; edit (Remove is inside the form, to give names room on
    phones); the + button adds.
  - Automatic rows (class prep, goal practice) are tagged, with where to change them.
- **Follow-up from your review:**
  - Weekly hours: "School starts / School ends" column captions and a one-line explanation.
  - "Copy to other school days" is a real button, right under Monday.
  - After-school is now an **activity with an end time** (new column `after_school_until`,
    migration `20261112130000`). My Day shows it on the timetable and moves "Home from school"
    and the must-do deadline to that time. A half day cancels it. 25 tests pass.
- **Activities:** a "Prep task for My Day" field. **Goals:** "Daily practice" plus School /
  Holidays / Every day.
- **Settings on phones:** a 3×2 section switch, so all six labels fit (it fixes "Categori…" too).
- **Checked** with Playwright on iPhone 13 using taps, and on desktop at 1280px:
  - Set up the school.
  - Add a half day.
  - Add 6 routine lines, reorder one, filter by weekday and remove one.
  - A prep task shows only on its class's day.
  - A goal's practice saves.
  - No console errors; the other tabs still load.
  - The test data was removed afterwards. The copy keeps the imported holidays only.
- `tsc` passes; 23 tests pass; no new lint errors (the 3 in `SettingsDialog` were already there,
  from the `children` prop pattern; the new tabs use `childList`).

## Stage 3 review (12 Nov)

- **Migration** `20261112140000_homework` (copy only): `activities.homework_from` and
  `homework_note`, plus `task_ticks.skipped`. Purely additive.
- **Homework rules** in `lib/my-day.ts`:
  - One piece per lesson since homework was switched on (looking back at most 42 days).
  - None for lessons logged absent or cancelled; today's lesson counts once it has ended.
  - Due the day before the next lesson, or the lesson plus 6 days when there's no next lesson.
  - Due within 3 days or overdue goes in Do first and blocks Free Play; later shows as
    "Not due yet". A tick closes it for good.
- **Deadline:** must-dos are due before the first class after they're home, moving to the next
  class once that one has started.
- **Activities form:** "Gives homework after each lesson" plus a note. It's counted from the day
  it's switched on.
- **My Day** (`/my-day`, `components/my-day/MyDayView.tsx`):
  - Full screen, with no app navigation or Settings. Child switch, remembered per tablet.
  - Header shows the day, the time, and why there's no school today.
  - Now card with "I'm done"; a progress bar; Do first (with homework and its tags), Hobby, and
    Free Play (locked, then "Playing … started …"); the Today timetable with now highlighted.
  - Ticks show at once, and are put back if saving fails. The clock updates every 30 seconds,
    ticks refresh every minute, and settings data every 5 minutes.
  - Its own manifest (`/my-day.webmanifest`, start `/my-day`), so it gets its own home-screen
    icon.
- **Checked** on a 1180×820 touch tablet with taps, using your real routine and hours, and on
  820×1180 portrait:
  - AQSA homework switched on from 1 Nov showed "Overdue · from the 5 Nov lesson · due Wed 11 Nov".
  - "I'm done" stamped 4:28 PM, and it survived a reload.
  - Free Play unlocked, then locked again on untick.
  - No console errors. The test data was undone afterwards (your 3 routine items are kept).
- 34 tests pass; `tsc` passes; `next build` succeeds; no new lint errors.
- **Moved to stage 4** (it's a parent control on Home): "No homework this time", and ticking
  homework on a child's behalf.

## Goals: both children, compact cards (13 Nov)

- Goals shows every child by default, each in their own section (avatar, name, "2 in progress ·
  1 achieved"), with multi-select child pills like Home (remembered per device; at least one stays on).
- Cards are more compact: the status pill sits beside the title, the "Milestone" / "Measured"
  label row is gone, tighter spacing. Nothing truncates: titles and "Next: …" wrap.
- **New goal** asks "New goal for… Zayyan / Zara" when more than one child is showing; each child
  with nothing in progress has its own **Add a goal**.
- Checked on iPhone SE and iPhone 13: no clipped text, no sideways scroll, no console errors.

## UI/UX review (13 Nov, with the ui-ux-pro-max checklist)

Checked Home's day view, the routine cards, the date bar, the add-task form and the tablet, on a
375px phone, an iPhone 13 and a tablet in both orientations. Fixed:
- **Loading:** grey placeholder cards while the day loads; before, every child flashed "No
  routine yet · Set up routine" for a moment.
- **Contrast:** small grey text (group names, "not yet", task notes) was 3.4:1; now 6.8:1.
- **Date bar marks:** red dot = not logged, green tick = logged, hollow ring = planned. Shapes as
  well as colours (red and green look alike to colour-blind people; the old green was 2.9:1).
- **Month button:** "Nov 2026" instead of "November…" cut off beside Today on small phones.
- **Future days:** no "0 of 3" or empty progress bar.
- **Failed saves:** if a tick (or removing a one-off) can't save, a message says so, on Home and on
  the tablet (in kids' words); before, the tick just quietly undid itself.
- **Touch and feedback:** buttons that were 40px are now 44px; tick circles and day buttons
  respond when pressed; the Do first / Hobby / Free Play choice works with a keyboard.
- **Headings** in order (Routines → child → Do first) for screen readers.
- Not changed: removing a one-off has no "are you sure" (it's quick to add again); the app has no
  dark mode, so none to check.

## Stage 6 review (13 Nov)

- **Midnight fix on Home:** a day you tap now lasts only the day you tapped it, so Home left open
  overnight moves to the new today (it used to stay on yesterday). The unlogged-sessions window
  also moves with the date.
- **Full walk-through** with a temporary child "Testy" and a "TEST cal" calendar (both deleted
  afterwards, with everything attached; your children and calendars untouched):
  - Set up through the same APIs the Settings forms use: Mon–Fri school hours, a half day today
    ending 11:00, and a routine (2 Do first, 1 Hobby, 1 Free Play).
  - Phone (iPhone 13, taps): Settings › Routines listed the items; Settings › Calendar listed the
    half day; Home showed Testy's card "0 of 3" and the half day in the timetable.
  - Tablet (1180×820, touch): Free Play "Locked"; two taps on **I'm done** stamped "Done at 9:47 AM"
    on both and unlocked Free Play.
  - Back on the phone: Home showed "2 of 3", "Do first done", both times, and no "by parent".
  - Goals, History, Analytics, Journal, Home and every Settings section opened. No console errors.
- **Zayyan on Fridays:** his three routine items are set to Mon, Tue and Thu, so Fridays are empty
  by design; change the weekdays in Settings › Routines if that's not intended.
- `tsc` passes, 47 tests pass, `next build` succeeds. Lint: the 7 errors in files this branch
  touched all exist on `main` too (none new).
- **Left for you:** try it on your real phone and the tablet over the hotspot.

## Stage 5 review (12 Nov)

- **Data:** migration `20261112150000_day_plans` (my-day copy only, additive): `task_ticks.by`
  (child | parent) and a `day_plans` table. `GET/PUT /api/day-plans`; ticks accept `by`.
- **Rules (`lib/my-day.ts`):** `buildDay` takes a saved `plan` and `homework: false`; returns
  `plan` (the list to save) and `doneBy` per task; ticked items no longer on the list still show,
  as done. 5 new tests, plus 5 for the banner (44 in all).
- **Shared hook (`lib/use-my-day.ts`):** `useMyDays(now, { date, by })` — today live, past days
  from their saved list as at end of day, future days read-only (`canTick`). Saves today's list
  when it changes (compared field by field, since the database reorders JSON keys).
- **Home (`components/views/HomeView.tsx` + `components/day/`):**
  - `DateBar`: 7-day strip, ‹ › weeks, calendar ("Go") and Today; dots and amber not-logged counts.
  - Timetable for the selected children: school, home time, fixed times (shared lines merged),
    classes in time order with Now / Up next.
  - `ClassRow`: one-tap Attended / Absent / Cancelled (sender and fetcher guessed as the form
    does). Once logged, the row shows only the outcome and the pencil (full form). In-place
    sender / fetcher / reflection chips were tried and removed at your request (12 Nov).
  - `RoutineCard` per child (replaces `KidsTodayCard`): tick anything; "ticked by parent" or
    "ticked later by parent · Thu 12 Nov, 8:35 PM"; future days can't be ticked.
  - Not-logged reminder is per day; the + button adds on the chosen date.
  - **Layout (changed at your request, 12 Nov):** under the day's name come the routines, then
    the timetable at the bottom. Each child's routine card opens with a big banner and a short,
    encouraging line (`cheer()` in `lib/my-day.ts`, 5 tests): "Let's go · before AQSA at
    4:00 PM / First up: Eat lunch", "Nice work! 2 more to go.", "Well done! Hobby time next.",
    "Great work, Zayyan! Free Play is yours." (green); past days "Zayyan did it all. Well done!"
    or "Good effort, Zayyan!"; future days "Coming up · 3 things planned".
  - **Top of Home (12 Nov):** title and subtitle, then the day's name, the date bar, then the
    child pills. Date-bar dots: red = a session not logged, green = all logged so far, grey =
    still to come. The "every past session is logged" line is gone (the amber reminder still
    shows when something isn't logged). The "Open My Day" links on Home are removed; My Day is
    still reachable from the sidebar on larger screens. The phone header's My Day icon (next to
    the gear) was removed too, at your request; the tablet opens My Day from its own home-screen icon.
  - **Every selected child gets a card (12 Nov):** a child with nothing set up (Zara) shows "No
    routine yet" and **Set up {name}'s routine**, which opens Settings on Routines (the Settings
    section now lives in the nav context, `openSettings("routines")`); a child with a routine but
    nothing on that day shows "Nothing on the list this day".
  - **No subtitle on Home (13 Nov):** the "Fri 13 Nov · 1 class" line under the title is gone
    (`Header` takes `subtitle={null}` for no line); the day heading below already says the date.
  - **One-off tasks (13 Nov):** "Add a task" on each child's card (also on the empty cards) adds
    a task for that child on the day shown, in Do first, Hobby or Free Play. It shows on Home
    ("Just this day", with a × to remove it) and on the tablet (polled each minute), counts
    towards "x of y" and Free Play, and is saved in the day's list.
    - New table `one_off_tasks` (migration `20261113090000_one_off_tasks`, applied to the copy
      only); `GET/POST /api/one-off-tasks`, `DELETE /api/one-off-tasks/[id]` (also removes its tick).
    - Ticked under `oneoff:<id>`. A saved past list takes its one-offs from the table, so adding
      or removing one on a past day shows correctly. 3 new tests.
    - Checked with taps: added one for Zara today, ticked it ("ticked by parent"), seen on Zara's
      tablet screen, removed it; task, tick and the empty saved list my test left were cleaned up.
- **Checked** on an iPhone 13 with taps: day strip and weeks; a late tick on Tue 10 Nov showed
  "ticked later by parent"; Mon 16 Nov's boxes disabled; Soccer logged in one tap with sender and
  fetcher filled, then only the pencil shown, which opens the form (test log deleted); today's list saved once and
  not re-saved on reload; the tablet still loads, with no "by parent". No console errors.
  Test tick and test log removed; your own ticks from this evening untouched.
- `tsc` passes, 47 tests pass, `next build` succeeds; no new lint errors (the two left are the
  attendance form's reset effect and Home's `children` prop, both from before).

## Stage 4 review (12 Nov)

- `lib/use-my-day.ts`: one shared hook (data, day rules, tick, untick, skip) used by both the
  tablet and Home, so the two always agree. My Day was refactored onto it, with no change in
  behaviour.
- **Home › Kids today** (`components/my-day/KidsTodayCard.tsx`), shown on this week, for the
  selected children:
  - A row per child with something planned: "x of y" and a progress bar.
  - A hint: "4 Do first left, before AQSA at 4:00 PM", "All done for today", or "No school · …",
    plus the last tick and its time.
  - Tap a row for the full log (time, or "not yet"), with homework tags and Free Play picks.
  - Homework actions: **Mark done**, **No homework this time**, and **Undo**.
  - "Open My Day" (the card) and "Open {name}'s My Day" (opens on that child, via `?child=`,
    with a way back).
- **Checked** on an iPhone 13 and a tablet, with taps:
  - A tick on the tablet showed on Home ("Last: Eat lunch · 5:02 PM").
  - Three overdue AQSA lessons each got their own row; Mark done, skip and undo all worked, and
    the tablet reflected them.
  - Open My Day → back.
  - No console errors. The test data was undone (your routine kept; AQSA homework off again).
- 34 tests pass; `tsc` passes; `next build` succeeds; no new lint errors.

---

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
