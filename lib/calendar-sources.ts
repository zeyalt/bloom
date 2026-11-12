/*
 * Where Bloom's calendar dates come from. Nothing here is guessed: each block names its
 * source, and dates were checked against it when added.
 *
 *   MOE_PRIMARY       — MOE's terms, vacations and extra school holidays (MK and primary).
 *   PUBLIC_HOLIDAYS   — MOM's gazetted public holidays, as published on data.gov.sg. Used
 *                       when data.gov.sg can't be reached; otherwise fetched live.
 *
 * Adding a year: copy MOE's "School terms and holidays for <year>" release (out each July)
 * into MOE_PRIMARY. Public holidays need nothing: the Import button fetches them.
 */
import type { CalendarDayKind } from "./types";

export interface SeedDay {
  id: string;        // stable, so importing again updates instead of duplicating
  kind: CalendarDayKind;
  title: string;
  start: string;     // YYYY-MM-DD
  end: string;
  levels?: string;   // only these levels ("P2,P3")
}

const span = (id: string, kind: CalendarDayKind, title: string, start: string, end = start, levels?: string): SeedDay =>
  ({ id, kind, title, start, end, ...(levels ? { levels } : {}) });

export const MOE_PRIMARY: Record<number, SeedDay[]> = {
  // Source: moe.gov.sg/calendar (2026 school terms and holidays, MK, Primary & Secondary).
  2026: [
    span("moe-2026-t1", "term", "Term 1", "2026-01-02", "2026-03-13"),
    span("moe-2026-t2", "term", "Term 2", "2026-03-23", "2026-05-29"),
    span("moe-2026-t3", "term", "Term 3", "2026-06-29", "2026-09-04"),
    span("moe-2026-t4", "term", "Term 4", "2026-09-14", "2026-11-20"),
    span("moe-2026-v1", "school_holiday", "March school holidays", "2026-03-14", "2026-03-22"),
    span("moe-2026-hrp-doil", "school_holiday", "Day off-in-lieu for Hari Raya Puasa", "2026-03-23"),
    span("moe-2026-v2", "school_holiday", "June school holidays", "2026-05-30", "2026-06-28"),
    span("moe-2026-youth", "school_holiday", "School holiday for Youth Day", "2026-07-06"),
    span("moe-2026-teachers", "school_holiday", "Teachers’ Day", "2026-09-04"),
    span("moe-2026-v3", "school_holiday", "September school holidays", "2026-09-05", "2026-09-13"),
    span("moe-2026-children", "school_holiday", "Children’s Day", "2026-10-02"),
    span("moe-2026-v4", "school_holiday", "Year-end school holidays", "2026-11-21", "2026-12-31"),
  ],
  // Source: MOE press release "School terms and holidays for 2027", 14 Jul 2026.
  2027: [
    span("moe-2027-t1", "term", "Term 1", "2027-01-04", "2027-03-12"),
    span("moe-2027-t2", "term", "Term 2", "2027-03-22", "2027-05-28"),
    span("moe-2027-t3", "term", "Term 3", "2027-06-28", "2027-09-03"),
    span("moe-2027-t4", "term", "Term 4", "2027-09-13", "2027-11-19"),
    span("moe-2027-start", "no_school", "First day is for P1 and K1 only", "2027-01-04", "2027-01-04", "K2,P2,P3,P4,P5,P6"),
    span("moe-2027-v1", "school_holiday", "March school holidays", "2027-03-13", "2027-03-21"),
    span("moe-2027-cny-doil", "school_holiday", "Day off-in-lieu for Chinese New Year", "2027-02-09"),
    span("moe-2027-labour-doil", "school_holiday", "Day off-in-lieu for Labour Day", "2027-05-03"),
    span("moe-2027-v2", "school_holiday", "June school holidays", "2027-05-29", "2027-06-27"),
    span("moe-2027-youth", "school_holiday", "School holiday for Youth Day", "2027-07-05"),
    span("moe-2027-natday", "school_holiday", "Day after National Day", "2027-08-10"),
    span("moe-2027-teachers", "school_holiday", "Teachers’ Day", "2027-09-03"),
    span("moe-2027-v3", "school_holiday", "September school holidays", "2027-09-04", "2027-09-12"),
    span("moe-2027-children", "school_holiday", "Children’s Day", "2027-10-08"),
    span("moe-2027-v4", "school_holiday", "Year-end school holidays", "2027-11-20", "2027-12-31"),
    span("moe-2027-xmas-doil", "school_holiday", "Day off-in-lieu for Christmas", "2027-12-27"),
  ],
};

// Source: data.gov.sg "Public Holidays for 2026" (d_149b61ad0a22f61c09dc80f2df5bbec8) and
// "Public Holidays for 2027" (d_0ba69fc6d56717ff0bf8083c6af3bb84), published by MOM.
export const PUBLIC_HOLIDAYS: Record<number, { date: string; title: string }[]> = {
  2026: [
    { date: "2026-01-01", title: "New Year’s Day" },
    { date: "2026-02-17", title: "Chinese New Year" },
    { date: "2026-02-18", title: "Chinese New Year" },
    { date: "2026-03-21", title: "Hari Raya Puasa" },
    { date: "2026-04-03", title: "Good Friday" },
    { date: "2026-05-01", title: "Labour Day" },
    { date: "2026-05-27", title: "Hari Raya Haji" },
    { date: "2026-05-31", title: "Vesak Day" },
    { date: "2026-06-01", title: "Vesak Day (Observed)" },
    { date: "2026-08-09", title: "National Day" },
    { date: "2026-08-10", title: "National Day (Observed)" },
    { date: "2026-11-08", title: "Deepavali" },
    { date: "2026-11-09", title: "Deepavali (Observed)" },
    { date: "2026-12-25", title: "Christmas Day" },
  ],
  2027: [
    { date: "2027-01-01", title: "New Year’s Day" },
    { date: "2027-02-06", title: "Chinese New Year" },
    { date: "2027-02-07", title: "Chinese New Year" },
    { date: "2027-02-08", title: "Chinese New Year (Observed)" },
    { date: "2027-03-10", title: "Hari Raya Puasa" },
    { date: "2027-03-26", title: "Good Friday" },
    { date: "2027-05-01", title: "Labour Day" },
    { date: "2027-05-17", title: "Hari Raya Haji" },
    { date: "2027-05-20", title: "Vesak Day" },
    { date: "2027-08-09", title: "National Day" },
    { date: "2027-10-28", title: "Deepavali" },
    { date: "2027-12-25", title: "Christmas Day" },
  ],
};

export const publicHolidayId = (date: string, title: string) =>
  `ph-${date}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;

const DATA_GOV = "https://api-production.data.gov.sg/v2/public/api";
const PUBLIC_HOLIDAYS_COLLECTION = 691; // "Singapore Public Holidays", one dataset per year

/**
 * A year's public holidays from data.gov.sg: finds the "Public Holidays for <year>"
 * dataset in MOM's collection, then reads its rows. Falls back to the copy above when
 * the site can't be reached; returns null when neither has that year.
 */
export async function fetchPublicHolidays(year: number): Promise<{ date: string; title: string }[] | null> {
  try {
    const meta = await fetch(`${DATA_GOV}/collections/${PUBLIC_HOLIDAYS_COLLECTION}/metadata`, { cache: "no-store" }).then(r => r.json());
    const ids: string[] = meta?.data?.collectionMetadata?.childDatasets ?? [];
    for (const id of ids) {
      const ds = await fetch(`${DATA_GOV}/datasets/${id}/metadata`, { cache: "no-store" }).then(r => r.json());
      if (ds?.data?.name !== `Public Holidays for ${year}`) continue;
      const rows = await fetch(`https://data.gov.sg/api/action/datastore_search?resource_id=${id}&limit=100`, { cache: "no-store" }).then(r => r.json());
      const records: { date?: string; holiday?: string }[] = rows?.result?.records ?? [];
      const list = records
        .filter(r => r.date && r.holiday)
        .map(r => ({ date: r.date!.slice(0, 10), title: r.holiday!.replace(/'/g, "’") }));
      if (list.length) return list;
    }
  } catch {
    // fall through to the copy
  }
  return PUBLIC_HOLIDAYS[year] ?? null;
}
