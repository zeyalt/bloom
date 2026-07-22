import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// AQSA lessons for Zayyan — "Did not attend" rows omitted.
// online: true → lessonType "Online" (Zoom), else "Normal".
const data = [
  { date: '2026-05-28', time: '16:00', duration: 120 },
  { date: '2026-05-21', time: '16:00', duration: 120 },
  { date: '2026-05-14', time: '16:00', duration: 120 },
  { date: '2026-05-07', time: '16:00', duration: 120 },
  { date: '2026-04-30', time: '16:00', duration: 120 },
  { date: '2026-04-23', time: '16:00', duration: 120 },
  { date: '2026-04-16', time: '16:00', duration: 120 },
  { date: '2026-04-09', time: '16:00', duration: 120 },
  { date: '2026-03-19', time: '16:00', duration: 120 },
  { date: '2026-03-12', time: '16:00', duration: 120, online: true },
  { date: '2026-03-05', time: '16:00', duration: 120, online: true },
  { date: '2026-02-26', time: '16:00', duration: 120 },
  { date: '2026-02-05', time: '16:00', duration: 120 },
  { date: '2026-01-29', time: '16:00', duration: 120 },
  { date: '2026-01-22', time: '16:00', duration: 120 },
  { date: '2025-11-13', time: '16:00', duration: 120 },
  { date: '2025-11-06', time: '16:00', duration: 120 },
  { date: '2025-10-30', time: '16:00', duration: 120 },
  { date: '2025-10-23', time: '16:00', duration: 120 },
  { date: '2025-10-16', time: '16:00', duration: 120 },
  { date: '2025-10-09', time: '16:00', duration: 120 },
  { date: '2025-10-02', time: '16:00', duration: 120 },
  { date: '2025-09-25', time: '16:00', duration: 120 },
  { date: '2025-09-18', time: '16:00', duration: 120 },
  { date: '2025-08-28', time: '16:00', duration: 120 },
  { date: '2025-08-21', time: '16:00', duration: 120 },
  { date: '2025-08-14', time: '16:00', duration: 120 },
  { date: '2025-08-07', time: '16:00', duration: 120 },
  { date: '2025-07-31', time: '16:00', duration: 120 },
  { date: '2025-07-24', time: '16:00', duration: 120 },
  { date: '2025-07-17', time: '16:00', duration: 120 },
  { date: '2025-07-10', time: '16:00', duration: 120 },
  { date: '2025-07-03', time: '16:00', duration: 120 },
  { date: '2025-05-29', time: '16:00', duration: 120 },
  { date: '2025-05-22', time: '16:00', duration: 120 },
  { date: '2025-05-15', time: '16:00', duration: 120 },
  { date: '2025-05-08', time: '16:00', duration: 120 },
  { date: '2025-04-24', time: '16:00', duration: 120 },
  { date: '2025-04-17', time: '16:00', duration: 120 },
  { date: '2025-04-10', time: '16:00', duration: 120 },
  { date: '2025-03-20', time: '16:00', duration: 105, online: true },
  { date: '2025-03-13', time: '16:00', duration: 105, online: true },
  { date: '2025-03-06', time: '16:00', duration: 105, online: true },
  { date: '2025-02-20', time: '16:00', duration: 120 },
  { date: '2025-02-13', time: '16:00', duration: 120 },
  { date: '2025-01-23', time: '16:00', duration: 120 },
  { date: '2025-01-16', time: '16:00', duration: 120 },
  { date: '2025-01-09', time: '16:00', duration: 120 },
];

function addMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

async function migrate() {
  try {
    console.log(`Migrating ${data.length} AQSA lessons for Zayyan...`);

    const logs = data.map(row => ({
      date: new Date(row.date + 'T00:00:00Z'),
      startTime: row.time,
      endTime: addMinutes(row.time, row.duration),
      status: 'attended',
      activityId: '8457b347-9933-43a6-95d5-00c1aa0cc049', // AQSA (Zayyan)
      childId: '79b47f32-639f-4953-92b4-e4849971e17d', // Zayyan
      instructorName: 'Ustazah Sabrina',
      lessonType: row.online ? 'Online' : 'Normal',
      durationMinutes: row.duration,
      // sentBy / fetcher intentionally left null
    }));

    const result = await prisma.attendanceLog.createMany({
      data: logs,
      skipDuplicates: true,
    });

    console.log(`✓ Successfully created ${result.count} attendance records`);
    await prisma.$disconnect();
  } catch (err) {
    console.error('Migration failed:', err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

migrate();
