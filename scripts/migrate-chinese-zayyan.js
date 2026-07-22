import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Chinese Tuition (Berries, 谢老师) for Zayyan. 120-min lessons, Level "P2 (Distinction)".
const ACTIVITY = 'cmqrzjksf0003dz83ke18a7t2';
const CHILD = '79b47f32-639f-4953-92b4-e4849971e17d';
const LEVEL = 'P2 (Distinction)';

const data = [
  { date: '2026-04-29', time: '14:30', lesson: 17 },
  { date: '2026-04-22', time: '14:30', lesson: 16 },
  { date: '2026-04-16', time: '16:30', lesson: 15, type: 'Replacement' },
  { date: '2026-04-08', time: '14:30', lesson: 14 },
  { date: '2026-04-01', time: '14:30', lesson: 13 },
  { date: '2026-03-25', time: '14:30', lesson: 12 },
  { date: '2026-03-18', time: '14:30', lesson: 11 },
  { date: '2026-03-11', time: '14:30', lesson: 10 },
  { date: '2026-03-04', time: '14:30', lesson: 9, remarks: 'Oral Test' },
  { date: '2026-02-25', time: '14:30', lesson: 8 },
  { date: '2026-02-18', time: '14:30', cancelled: 'Chinese New Year Break' },
  { date: '2026-02-11', time: '14:30', lesson: 7 },
  { date: '2026-02-04', time: '14:30', lesson: 6 },
  { date: '2026-01-28', time: '14:30', lesson: 5 },
  { date: '2026-01-21', time: '14:30', lesson: 4 },
  { date: '2026-01-14', time: '14:30', lesson: 3 },
  { date: '2026-01-07', time: '14:30', lesson: 2 },
  { date: '2025-12-31', time: '14:30', lesson: 1 },
];

function addMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

async function migrate() {
  try {
    console.log(`Migrating ${data.length} Chinese Tuition records for Zayyan...`);

    const logs = data.map(row => ({
      date: new Date(row.date + 'T00:00:00Z'),
      startTime: row.time,
      endTime: row.cancelled ? null : addMinutes(row.time, 120),
      status: row.cancelled ? 'cancelled_by_provider' : 'attended',
      activityId: ACTIVITY,
      childId: CHILD,
      instructorName: '谢老师',
      lessonType: row.cancelled ? null : (row.type || 'Normal'),
      level: LEVEL,
      lessonNumber: row.lesson ?? null,
      durationMinutes: row.cancelled ? null : 120,
      absenceReason: row.cancelled ?? null,
      remarks: row.remarks ?? null,
      // sentBy / fetcher left blank
    }));

    const result = await prisma.attendanceLog.createMany({ data: logs, skipDuplicates: true });
    const att = data.filter(d => !d.cancelled).length;
    console.log(`✓ Created ${result.count} records (${att} attended, 1 cancelled_by_provider)`);
    await prisma.$disconnect();
  } catch (err) {
    console.error('Migration failed:', err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

migrate();
