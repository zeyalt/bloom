import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MOE_PRIMARY, fetchPublicHolidays, publicHolidayId } from "@/lib/calendar-sources";

export const dynamic = "force-dynamic";

const MOE_CALENDAR_ID = "moe-primary";

/**
 * Brings the shared calendar up to date: the MOE primary calendar (terms and school
 * holidays for every year Bloom has) and public holidays for the years asked for.
 * Safe to run again — imported rows have stable ids, so they're updated, not duplicated.
 * Body: { years?: number[] } (default: this year and next)
 * Returns what each year got, and which years have no MOE dates in Bloom or no public
 * holidays published yet.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const thisYear = new Date().getFullYear();
    const years: number[] = Array.isArray(body.years) && body.years.length
      ? body.years.map(Number).filter((y: number) => Number.isInteger(y) && y > 2000 && y < 2100)
      : [thisYear, thisYear + 1];

    await prisma.schoolCalendar.upsert({
      where: { id: MOE_CALENDAR_ID },
      create: { id: MOE_CALENDAR_ID, name: "MOE primary schools", kind: "moe_primary" },
      update: {},
    });

    const rows: {
      id: string; calendarId: string | null; startDate: Date; endDate: Date;
      kind: string; title: string; levels: string | null; source: string;
    }[] = [];
    const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

    for (const [year, days] of Object.entries(MOE_PRIMARY)) {
      if (!years.includes(Number(year))) continue;
      for (const d of days) {
        rows.push({ id: d.id, calendarId: MOE_CALENDAR_ID, startDate: day(d.start), endDate: day(d.end), kind: d.kind, title: d.title, levels: d.levels ?? null, source: "moe" });
      }
    }

    const missing: number[] = [];
    const counts: Record<number, { moe: number; publicHolidays: number }> = {};
    for (const year of years) {
      const holidays = await fetchPublicHolidays(year);
      if (!holidays) missing.push(year);
      for (const h of holidays ?? []) {
        rows.push({ id: publicHolidayId(h.date, h.title), calendarId: null, startDate: day(h.date), endDate: day(h.date), kind: "public_holiday", title: h.title, levels: null, source: "data.gov.sg" });
      }
      counts[year] = { moe: MOE_PRIMARY[year]?.length ?? 0, publicHolidays: holidays?.length ?? 0 };
    }

    await prisma.$transaction(rows.map(({ id, ...data }) =>
      prisma.calendarDay.upsert({ where: { id }, create: { id, ...data }, update: data })
    ));

    return NextResponse.json({
      calendar_id: MOE_CALENDAR_ID,
      years: counts,
      missing_moe: years.filter(y => !MOE_PRIMARY[y]),
      missing_public_holidays: missing,
    });
  } catch (err) {
    console.error("POST calendars/import failed:", err);
    return NextResponse.json({ error: "Failed to import calendar" }, { status: 500 });
  }
}
