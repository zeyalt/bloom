/**
 * Restore Barca attendance rows that existed AFTER 2026-05-02 from a Neon
 * point-in-time branch, without touching the historical import.
 *
 * Setup (Neon Console → your project → Branches → Create branch):
 *   - Type: Point in time
 *   - Time: just BEFORE the bad Barca import (~17:35 SGT / 09:35 UTC on 30 Sep 2026)
 *   - Copy the new branch connection string
 *
 * Run:
 *   RECOVERY_DATABASE_URL="postgresql://..." node scripts/recover-barca-attendance-from-branch.js
 *
 * Uses .env.local DATABASE_URL as the live (current) database.
 */
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

const liveUrl = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim().replace(/^"|"$/g, "");
const recoveryUrl = process.env.RECOVERY_DATABASE_URL;

const BARCA_ACTIVITY_ID = "d3b8f8e8-b5ee-4b32-8284-71edb90bb7e4";
const CUTOFF = new Date("2026-05-03T00:00:00.000Z");

if (!liveUrl) throw new Error("Missing DATABASE_URL in .env.local");
if (!recoveryUrl) throw new Error("Set RECOVERY_DATABASE_URL to the PITR branch");

const live = new PrismaClient({ datasources: { db: { url: liveUrl } } });
const recovery = new PrismaClient({ datasources: { db: { url: recoveryUrl } } });

function rowKey(r) {
  const day = r.date.toISOString().slice(0, 10);
  return `${day}|${r.startTime ?? ""}`;
}

(async () => {
  const recovered = await recovery.attendanceLog.findMany({
    where: {
      activityId: BARCA_ACTIVITY_ID,
      date: { gte: CUTOFF },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  console.log(`Found ${recovered.length} Barca logs on recovery branch (>= 2026-05-03)`);
  if (recovered.length === 0) {
    console.log("Nothing to restore — pick an earlier PITR timestamp.");
    process.exit(1);
  }

  const existing = await live.attendanceLog.findMany({
    where: { activityId: BARCA_ACTIVITY_ID },
    select: { date: true, startTime: true },
  });
  const existingKeys = new Set(existing.map(rowKey));

  let inserted = 0;
  let skipped = 0;
  for (const r of recovered) {
    if (existingKeys.has(rowKey(r))) {
      skipped++;
      continue;
    }
    const { id, createdAt, updatedAt, ...data } = r;
    await live.attendanceLog.create({ data });
    inserted++;
  }

  console.log(`Inserted ${inserted}, skipped ${skipped} (already on live DB)`);
  console.log(
    "Sample:",
    recovered.slice(0, 3).map(r => `${r.date.toISOString().slice(0, 10)} ${r.startTime} ${r.status}`)
  );
})()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await live.$disconnect();
    await recovery.$disconnect();
  });
