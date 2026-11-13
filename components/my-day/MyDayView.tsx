"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Check, Lock } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { buildDay, type DayTask, type TimelineBlock } from "@/lib/my-day";
import { useMyDays, useNow } from "@/lib/use-my-day";
import { cn, formatTime } from "@/lib/utils";

const CHILD_KEY = "bloom.myday.child";

/** The child last chosen on this tablet, kept in localStorage (null on the server). */
const savedChild = {
  get: () => { try { return localStorage.getItem(CHILD_KEY); } catch { return null; } },
  set: (id: string) => {
    try { localStorage.setItem(CHILD_KEY, id); } catch { /* private mode */ }
    window.dispatchEvent(new Event(CHILD_KEY));
  },
  subscribe: (onChange: () => void) => {
    window.addEventListener(CHILD_KEY, onChange);
    window.addEventListener("storage", onChange);
    return () => { window.removeEventListener(CHILD_KEY, onChange); window.removeEventListener("storage", onChange); };
  },
};

const clock = (d: Date) => format(d, "h:mm a");
const at = (timestamp: string) => clock(new Date(timestamp));

/**
 * My Day — the kids' screen on the family tablet. Shows one child's day: the timetable
 * (Today), what to do now and next, and three lists: Do first, Hobby and Free Play
 * (locked until Do first is done). Ticking records the time; tapping again unticks.
 * Read-only otherwise: no settings, expenses or editing.
 */
export function MyDayView() {
  const now = useNow();
  const router = useRouter();
  const params = useSearchParams();
  // Opened from Bloom (not the kids' own icon): offer the way back.
  const fromBloom = params.get("from") === "bloom";
  const backToBloom = () => (window.history.length > 1 ? router.back() : router.push("/"));

  const { children, days, toggle: write, hhmm, isLoading, saveError, clearSaveError } = useMyDays(now);

  // ?child= (from Home's "Open My Day") wins; otherwise the child last chosen on this tablet.
  const savedId = useSyncExternalStore(savedChild.subscribe, savedChild.get, () => null);
  const childId = params.get("child") ?? savedId;
  const child = children.find(c => c.id === childId) ?? children[0];
  const pickChild = (id: string) => {
    savedChild.set(id);
    if (params.get("child")) router.replace(fromBloom ? "/my-day?from=bloom" : "/my-day");
  };
  const day = child ? days.get(child.id) : undefined;
  const toggle = useCallback((task: DayTask) => { if (child) void write(child, task); }, [child, write]);

  if (!child || !day) {
    return <Shell onBack={fromBloom ? backToBloom : undefined}><p className="text-lg text-[var(--ink-soft)]">{isLoading ? "Loading…" : "No children set up yet."}</p></Shell>;
  }

  const holiday = day.info.kind === "holiday";
  const subtitle = [
    `${format(now, "EEEE d MMM")} · it’s ${clock(now)}`,
    holiday ? `No school · ${day.info.reason}` : day.info.kind === "half_day" ? `Half day · ${day.info.reason}` : null,
  ].filter(Boolean).join(" · ");
  const doFirstDue = day.deadline ? `before ${day.deadline.label} at ${formatTime(day.deadline.time).replace(/^0/, "")}` : null;
  const playing = day.free.filter(f => f.doneAt).sort((a, b) => b.doneAt!.localeCompare(a.doneAt!))[0];
  const nothingPlanned = day.total === 0 && day.free.length === 0 && day.homeworkLater.length === 0;

  return (
    <Shell onBack={fromBloom ? backToBloom : undefined}>
      {/* Whose day, the time, and the child switch */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Avatar avatarKey={child.avatar_key} fallbackEmoji={child.avatar_emoji} size={56} />
          <div className="min-w-0">
            <h1 className="m-0 text-[30px] leading-9 md:text-[34px] md:leading-10 font-extrabold tracking-tight">{child.name}’s {format(now, "EEEE")}</h1>
            <p className="m-0 text-base leading-6 text-[var(--ink-soft)]">{subtitle}</p>
          </div>
        </div>
        {children.length > 1 && (
          <div role="group" aria-label="Whose day" className="flex gap-2">
            {children.map(c => {
              const on = c.id === child.id;
              return (
                <button key={c.id} type="button" aria-pressed={on} onClick={() => pickChild(c.id)}
                  className={cn("h-14 px-5 rounded-full text-lg font-bold border-2 cursor-pointer",
                    on ? "text-white" : "bg-[var(--sheet)] text-[var(--ink-soft)] border-[var(--rule)]")}
                  style={on ? { backgroundColor: c.color_code, borderColor: c.color_code } : undefined}>
                  {c.name}
                </button>
              );
            })}
          </div>
        )}
      </header>

      <div className="flex-1 min-h-0 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Today: the timetable */}
        <Timeline blocks={day.timeline} hhmm={hhmm} className="order-2 lg:order-1" />

        <div className="order-1 lg:order-2 min-w-0 flex flex-col gap-5">
          {saveError && (
            <p role="alert" className="m-0 flex items-center gap-3 p-4 text-base border-2 border-[var(--margin)] bg-[var(--sheet)] text-[var(--margin)] font-semibold">
              <span className="flex-1">That didn’t save. Tap it again, or ask a grown-up.</span>
              <button type="button" onClick={clearSaveError} className="h-12 px-5 rounded-full border-2 border-[var(--margin)] cursor-pointer">OK</button>
            </p>
          )}
          <NowCard day={day} doFirstDue={doFirstDue} onDone={toggle} nothingPlanned={nothingPlanned} />

          {day.total > 0 && (
            <div className="flex items-center gap-4" aria-label={`${day.done} of ${day.total} done`}>
              <span className="text-base font-semibold whitespace-nowrap">{day.done} of {day.total} done</span>
              <span aria-hidden="true" className="flex-1 flex gap-1 h-3">
                {[...day.must, ...day.practice].map(t => (
                  <span key={t.key} className={cn("flex-1 rounded", t.doneAt ? "bg-[var(--stem)]" : "bg-[#d5ded4]")} />
                ))}
              </span>
            </div>
          )}

          <div className={cn("grid gap-6", day.free.length > 0 && "md:grid-cols-2")}>
            <div className="flex flex-col gap-3 min-w-0">
              {(day.must.length > 0 || day.homeworkLater.length > 0) && (
                <ListHeading title="1 · Do first" note={day.must.length ? doFirstDue : null} />
              )}
              {day.must.map(t => <TaskRow key={t.key} task={t} onToggle={toggle} />)}
              {day.homeworkLater.length > 0 && (
                <>
                  <p className="mt-1 text-sm font-semibold text-[var(--ink-soft)]">Not due yet · you can start early</p>
                  {day.homeworkLater.map(t => <TaskRow key={t.key} task={t} onToggle={toggle} quiet />)}
                </>
              )}
              {day.practice.length > 0 && <ListHeading title="2 · Hobby" className="mt-3" />}
              {day.practice.map(t => <TaskRow key={t.key} task={t} onToggle={toggle} />)}
            </div>

            {day.free.length > 0 && (
              <section aria-label="Free Play"
                className={cn("flex flex-col gap-4 p-5 border self-start w-full box-border",
                  day.freeUnlocked ? "bg-[var(--sheet)] border-[#9cc5a8]" : "bg-[#e8ede6] border-dashed border-[#b5c2b4]")}>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="m-0 text-lg font-bold">3 · Free Play</h2>
                  {!day.freeUnlocked && (
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--ink-soft)]">
                      <Lock size={16} aria-hidden="true" /> Locked
                    </span>
                  )}
                </div>
                <p className="m-0 text-base text-[var(--ink-soft)]">
                  {day.freeUnlocked ? "Unlocked! Pick what you want to do." : "Finish Do first and these unlock."}
                </p>
                <div className="flex flex-wrap gap-3">
                  {day.free.map(f => (
                    <button key={f.key} type="button" disabled={!day.freeUnlocked} aria-pressed={!!f.doneAt} onClick={() => toggle(f)}
                      className={cn("h-14 px-5 rounded-full text-base font-semibold border",
                        !day.freeUnlocked ? "bg-[var(--paper)] text-[var(--ink-faint)] border-[var(--rule)] cursor-not-allowed"
                          : f.doneAt ? "bg-[var(--ink)] text-[var(--sheet)] border-[var(--ink)] cursor-pointer"
                          : "bg-white text-[var(--ink)] border-[var(--rule)] cursor-pointer")}>
                      {f.title}
                    </button>
                  ))}
                </div>
                {day.freeUnlocked && playing && (
                  <p className="m-0 px-4 py-3 bg-[#d9eadc] text-[#1f5a3c] text-base font-semibold">
                    Playing: {playing.title} · started {at(playing.doneAt!)}
                  </p>
                )}
              </section>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children, onBack }: { children: React.ReactNode; onBack?: () => void }) {
  return (
    <div className="h-full overflow-y-auto overscroll-y-contain bg-[var(--paper)] text-[var(--ink)]">
      <main className="min-h-full max-w-[1280px] mx-auto box-border flex flex-col gap-6 px-4 py-6 md:px-8 md:py-7 pb-[calc(24px+env(safe-area-inset-bottom))]">
        {onBack && (
          <button type="button" onClick={onBack}
            className="-mt-2 -mb-3 -ml-2 self-start inline-flex items-center gap-2 h-12 px-2 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--ink)] cursor-pointer">
            <ArrowLeft size={20} aria-hidden="true" /> Bloom
          </button>
        )}
        {children}
      </main>
    </div>
  );
}

function ListHeading({ title, note, className }: { title: string; note?: string | null; className?: string }) {
  return (
    <h2 className={cn("m-0 flex flex-wrap items-baseline gap-x-2 text-lg leading-6 font-bold", className)}>
      {title}
      {note && <span className="text-sm font-medium text-[var(--ink-soft)]">{note}</span>}
    </h2>
  );
}

function NowCard({ day, doFirstDue, onDone, nothingPlanned }: {
  day: NonNullable<ReturnType<typeof buildDay>>;
  doFirstDue: string | null;
  onDone: (t: DayTask) => void;
  nothingPlanned: boolean;
}) {
  if (nothingPlanned) {
    return (
      <div className="p-6 bg-[var(--sheet)] border border-[var(--rule)]">
        <p className="m-0 text-2xl font-extrabold">Nothing on your list today</p>
        <p className="m-0 mt-1 text-base text-[var(--ink-soft)]">Ask a grown-up to set up your routine in Bloom.</p>
      </div>
    );
  }
  if (!day.now) {
    return (
      <div className="p-6 bg-[var(--stem)] text-[var(--sheet)]">
        <p className="m-0 text-sm font-bold uppercase tracking-wider opacity-85">All done</p>
        <p className="m-0 mt-1 text-[30px] leading-9 font-extrabold">Great work! Free Play is yours.</p>
      </div>
    );
  }
  const isDoFirst = day.must.includes(day.now);
  return (
    <div className="p-5 md:p-6 bg-[var(--sheet)] border-2 border-[var(--stem)] flex flex-wrap items-center justify-between gap-5">
      <div className="min-w-0 flex-1 basis-64">
        <p className="m-0 text-sm font-bold uppercase tracking-wider text-[var(--stem)]">
          Now · {isDoFirst ? `do first${doFirstDue ? `, ${doFirstDue}` : ""}` : "hobby time"}
        </p>
        <p className="m-0 mt-1 text-[28px] leading-9 md:text-[30px] font-extrabold tracking-tight break-words">{day.now.title}</p>
        <p className="m-0 mt-1 text-base text-[var(--ink-soft)]">
          Next: {day.next ? day.next.title : day.free.length ? "Free Play" : "all done"}
        </p>
      </div>
      <button type="button" onClick={() => onDone(day.now!)}
        className="shrink-0 h-16 px-7 rounded-full bg-[var(--stem)] text-[var(--sheet)] text-lg font-bold flex items-center gap-2 cursor-pointer active:scale-[0.98]">
        <Check size={22} strokeWidth={3} aria-hidden="true" /> I’m done
      </button>
    </div>
  );
}

function TaskRow({ task, onToggle, quiet }: { task: DayTask; onToggle: (t: DayTask) => void; quiet?: boolean }) {
  const done = !!task.doneAt;
  const hw = task.homework;
  const tagCls = task.source.kind === "goal" ? "bg-[#d9eadc] text-[#1f5a3c]"
    : task.source.kind === "homework" ? "bg-[#fdf0dc] text-[#8a4207]"
    : "bg-[#e3ebf7] text-[#1d3f78]";
  return (
    <button type="button" aria-pressed={done} onClick={() => onToggle(task)}
      className={cn("w-full min-h-16 box-border flex items-center gap-4 px-4 py-3 text-left border cursor-pointer",
        done ? "bg-[#eaf3ec] border-[#9cc5a8]" : quiet ? "bg-[var(--paper)] border-dashed border-[var(--rule)]" : "bg-[var(--sheet)] border-[var(--rule)]")}>
      <span aria-hidden="true" className={cn("w-8 h-8 shrink-0 rounded-lg flex items-center justify-center box-border",
        done ? "bg-[var(--stem)] text-[var(--sheet)]" : "bg-white border-2 border-[var(--ink-faint)]")}>
        {done && <Check size={18} strokeWidth={3.2} />}
      </span>
      <span className="min-w-0 flex flex-col gap-1">
        <span className={cn("text-[17px] leading-[22px] font-bold break-words",
          done && "text-[var(--ink-soft)] line-through decoration-[#9cc5a8]")}>{task.title}</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-5 text-[var(--ink-soft)]">
          {hw?.overdue && !done && <span className="px-2 rounded-full bg-[#f6e3e1] text-[#8f1d14] font-semibold">Overdue</span>}
          {task.source.label && <span className={cn("px-2 rounded-full font-semibold", tagCls)}>{task.source.label}</span>}
          {hw?.note && <span>{hw.note}</span>}
          {done && <span className="font-bold text-[#1f5a3c]">Done at {at(task.doneAt!)}</span>}
        </span>
      </span>
    </button>
  );
}

function Timeline({ blocks, hhmm, className }: { blocks: TimelineBlock[]; hhmm: string; className?: string }) {
  // The block happening now: the last one that has started.
  const current = [...blocks].reverse().find(b => b.time <= hhmm);
  return (
    <section aria-label="Today’s timetable" className={cn("bg-[var(--sheet)] border border-[var(--rule)] p-4 md:p-5 flex flex-col gap-1 self-start w-full box-border", className)}>
      <h2 className="m-0 mb-2 text-sm font-bold uppercase tracking-wider text-[var(--ink-soft)]">Today</h2>
      {blocks.length === 0 && <p className="m-0 text-base text-[var(--ink-soft)]">Nothing at a set time today.</p>}
      {blocks.map((b, i) => {
        const isNow = b === current;
        const past = !isNow && b.time < hhmm;
        return (
          <div key={`${b.time}-${b.label}-${i}`}
            className={cn("flex gap-3 px-3 py-2 border-l-4",
              isNow ? "bg-[#e7f1ea] border-[var(--stem)]" : b.kind === "class" ? "bg-[#eef3fa] border-[#3d63a8]" : "border-transparent",
              past && "opacity-60")}>
            <span className="w-[76px] shrink-0 text-sm leading-6 font-semibold text-[var(--ink-soft)] tabular-nums">{formatTime(b.time).replace(/^0/, "")}</span>
            <span className="min-w-0 flex flex-col">
              <span className="text-base leading-6 font-semibold break-words">{b.label}{isNow && <span className="sr-only"> (now)</span>}</span>
              {(b.sub || b.end) && (
                <span className="text-sm leading-5 text-[var(--ink-soft)]">
                  {[b.sub, b.end ? `till ${formatTime(b.end).replace(/^0/, "")}` : null].filter(Boolean).join(" · ")}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </section>
  );
}
