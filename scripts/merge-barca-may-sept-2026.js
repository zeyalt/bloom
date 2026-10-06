/**
 * Merge Barca Mon 18:00 + Sat 09:30 sessions (May–Sep 2026) without deleting existing rows.
 * Run: node scripts/merge-barca-may-sept-2026.js
 */
const { readFileSync } = require("fs");
const { PrismaClient } = require("@prisma/client");

const env = readFileSync(".env.local", "utf8");
process.env.DATABASE_URL = env
  .match(/^DATABASE_URL=(.+)$/m)[1]
  .trim()
  .replace(/^"|"$/g, "");

const prisma = new PrismaClient();

const ACTIVITY_ID = "d3b8f8e8-b5ee-4b32-8284-71edb90bb7e4";
const CHILD_ID = "79b47f32-639f-4953-92b4-e4849971e17d";
const LOCATION = "Nexus International School";

/** @type {Record<string, string>} date (YYYY-MM-DD) → absence reason */
const ABSENT = {
  "2026-06-06": "Overseas",
  "2026-06-08": "Overseas",
  "2026-06-13": "Overseas",
  "2026-06-15": "Overseas",
  "2026-07-25": "Conflict",
  "2026-08-10": "Other",
  "2026-09-05": "Conflict",
};

const COACH_CUTOVER = "2026-08-17";

function pad(n) {
  return String(n).padStart(2, "0");
}

function toDateStr(d) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function coachFor(dateStr) {
  return dateStr >= COACH_CUTOVER ? "Coach Jovis" : "Coach Omer";
}

function transport(startTime) {
  if (startTime === "18:00") return { sentBy: "Atiqah", fetcher: "Atiqah" };
  if (startTime === "09:30") return { sentBy: "Zeya", fetcher: "Zeya" };
  throw new Error(`Unexpected start ${startTime}`);
}

/** Term windows from DB schedules (inclusive start, inclusive end). */
const TERMS = [
  { from: "2026-04-20", until: "2026-07-12" },
  { from: "2026-07-13", until: "2026-10-04" },
];

function inTerm(dateStr) {
  return TERMS.some(t => dateStr >= t.from && dateStr <= t.until);
}

function generateSlots(fromStr, untilStr) {
  const slots = [];
  const from = new Date(`${fromStr}T12:00:00.000Z`);
  const until = new Date(`${untilStr}T12:00:00.000Z`);
  for (let d = new Date(from); d <= until; d.setUTCDate(d.getUTCDate() + 1)) {
    const dow = d.getUTCDay();
    const dateStr = toDateStr(d);
    if (!inTerm(dateStr)) continue;
    if (dow === 1) slots.push({ dateStr, startTime: "18:00", endTime: "19:30" });
    if (dow === 6) slots.push({ dateStr, startTime: "09:30", endTime: "11:00" });
  }
  return slots;
}

function rowPayload(slot) {
  const { sentBy, fetcher } = transport(slot.startTime);
  const absentReason = ABSENT[slot.dateStr];
  const isAbsent = Boolean(absentReason);
  return {
    activityId: ACTIVITY_ID,
    childId: CHILD_ID,
    date: new Date(`${slot.dateStr}T00:00:00.000Z`),
    startTime: slot.startTime,
    endTime: isAbsent ? null : slot.endTime,
    durationMinutes: isAbsent ? null : 90,
    status: isAbsent ? "absent" : "attended",
    sentBy,
    fetcher,
    instructorName: isAbsent ? null : coachFor(slot.dateStr),
    lessonType: isAbsent ? null : "Normal",
    location: LOCATION,
    absenceReason: absentReason ?? null,
  };
}

(async () => {
  const slots = generateSlots("2026-05-01", "2026-09-30");
  let created = 0;
  let updated = 0;

  for (const slot of slots) {
    const data = rowPayload(slot);
    const existing = await prisma.attendanceLog.findFirst({
      where: {
        activityId: ACTIVITY_ID,
        childId: CHILD_ID,
        date: data.date,
        startTime: slot.startTime,
      },
    });

    if (existing) {
      await prisma.attendanceLog.update({
        where: { id: existing.id },
        data: {
          ...data,
          learned: existing.learned,
          diaryNotes: existing.diaryNotes,
          remarks: existing.remarks,
        },
      });
      updated++;
    } else {
      await prisma.attendanceLog.create({ data });
      created++;
    }
  }

  const inRange = await prisma.attendanceLog.findMany({
    where: {
      activityId: ACTIVITY_ID,
      date: {
        gte: new Date("2026-05-01T00:00:00.000Z"),
        lte: new Date("2026-09-30T00:00:00.000Z"),
      },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  const attended = inRange.filter(l => l.status === "attended").length;
  const absent = inRange.filter(l => l.status === "absent").length;

  console.log(`Merge complete: ${created} created, ${updated} updated`);
  console.log(`May–Sep Barca rows: ${inRange.length} (${attended} attended, ${absent} absent)`);
  console.log("Date range:", toDateStr(inRange[0].date), "→", toDateStr(inRange.at(-1).date));

  console.log("\nAbsent sessions:");
  inRange
    .filter(l => l.status === "absent")
    .forEach(l =>
      console.log(`  ${toDateStr(l.date)} ${l.startTime} — ${l.absenceReason}`)
    );

  await prisma.$disconnect();
})().catch(async e => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
