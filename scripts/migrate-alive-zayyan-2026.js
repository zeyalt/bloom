import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// aLIVE Madrasah lessons for Zayyan (2026) — "Did not attend" rows omitted.
const data = [
  { date: '2026-04-28', time: '15:00', duration: 180 },
  { date: '2026-04-21', time: '15:00', duration: 180 },
  { date: '2026-04-14', time: '15:00', duration: 180 },
  { date: '2026-04-07', time: '15:00', duration: 180 },
  { date: '2026-03-31', time: '15:00', duration: 180 },
  { date: '2026-03-24', time: '15:00', duration: 180 },
  { date: '2026-03-11', time: '15:00', duration: 180 },
  { date: '2026-03-03', time: '15:00', duration: 180 },
  { date: '2026-02-24', time: '15:00', duration: 180 },
  { date: '2026-02-10', time: '15:00', duration: 180 },
  { date: '2026-02-03', time: '15:00', duration: 180 },
  { date: '2026-01-27', time: '15:00', duration: 180 },
  { date: '2026-01-20', time: '15:00', duration: 180 },
  { date: '2026-01-13', time: '15:00', duration: 180 },
];

function addMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

async function migrate() {
  try {
    console.log(`Migrating ${data.length} aLIVE Madrasah lessons for Zayyan...`);

    const logs = data.map(row => ({
      date: new Date(row.date + 'T00:00:00Z'),
      startTime: row.time,
      endTime: addMinutes(row.time, row.duration),
      status: 'attended',
      activityId: 'cmqrzinlh0001dz83q1vz7oxu', // aLIVE Madrasah (Zayyan)
      childId: '79b47f32-639f-4953-92b4-e4849971e17d', // Zayyan
      instructorName: 'Ustaz Hanif',
      lessonType: 'Normal',
      level: 'Kids 4T',
      durationMinutes: row.duration,
      sentBy: 'helper',
      fetcher: 'Zeya',
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
