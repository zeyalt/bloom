import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Chinese Tuition (Berries, 谢老师) for Zayyan — the four May 2026 lessons that
// were missing between Lesson 17 (29 Apr) and the 17 Jun resumption.
// 27 May was a public holiday, replaced by an online lesson on 28 May;
// 1–14 Jun were Berries holidays, so no lessons fall in that window.
const ACTIVITY = 'cmqrzjksf0003dz83ke18a7t2';
const CHILD = '79b47f32-639f-4953-92b4-e4849971e17d';
const LEVEL = 'P2 (Distinction)';
const INSTRUCTOR = '谢老师';
const VENUE = 'Punggol Coast Mall';

// Defaults: 14:30, Normal, 120 min, in person at the usual venue.
const data = [
  { date: '2026-05-06', lesson: 18 },
  { date: '2026-05-13', lesson: 19 },
  { date: '2026-05-20', lesson: 20 },
  { date: '2026-05-28', lesson: 21, time: '14:00', type: 'Online', location: null, remarks: 'Online replacement for 27 May (Public Holiday)' },
];

function addMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

async function backfill() {
  try {
    // Attendance logs have no natural unique key, so guard against a re-run.
    const clash = await prisma.attendanceLog.findFirst({
      where: { activityId: ACTIVITY, date: { in: data.map(r => new Date(r.date + 'T00:00:00Z')) } },
    });
    if (clash) {
      console.error(`✗ ${clash.date.toISOString().slice(0, 10)} already exists — nothing to do.`);
      await prisma.$disconnect();
      process.exit(1);
    }

    const logs = data.map(row => {
      const time = row.time ?? '14:30';
      return {
        date: new Date(row.date + 'T00:00:00Z'),
        startTime: time,
        endTime: addMinutes(time, 120),
        status: 'attended',
        activityId: ACTIVITY,
        childId: CHILD,
        instructorName: INSTRUCTOR,
        lessonType: row.type ?? 'Normal',
        level: LEVEL,
        location: row.location === null ? null : VENUE,
        lessonNumber: row.lesson,
        durationMinutes: 120,
        remarks: row.remarks ?? null,
        // sentBy / fetcher left blank
      };
    });

    const result = await prisma.attendanceLog.createMany({ data: logs });
    console.log(`✓ Created ${result.count} records (Lessons ${data[0].lesson}–${data.at(-1).lesson})`);
    await prisma.$disconnect();
  } catch (err) {
    console.error('Backfill failed:', err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

backfill();
