import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Your data - filter out "did not attend" rows
const data = [
  { date: '2026-05-31', time: '08:15', duration: 45 },
  { date: '2026-05-24', time: '08:15', duration: 45 },
  { date: '2026-05-03', time: '08:15', duration: 45 },
  { date: '2026-04-26', time: '08:15', duration: 45 },
  { date: '2026-04-19', time: '08:15', duration: 45 },
  { date: '2026-04-12', time: '08:15', duration: 45 },
  { date: '2026-03-29', time: '08:15', duration: 45 },
  { date: '2026-03-22', time: '08:15', duration: 45 },
  { date: '2026-03-15', time: '08:15', duration: 45 },
  { date: '2026-03-08', time: '08:15', duration: 45 },
  { date: '2026-02-15', time: '08:15', duration: 45 },
  { date: '2026-02-01', time: '08:15', duration: 45 },
  { date: '2026-01-18', time: '08:15', duration: 45 },
  { date: '2026-01-04', time: '08:15', duration: 45 },
  { date: '2025-12-21', time: '08:15', duration: 45 },
  { date: '2025-12-14', time: '08:15', duration: 0 },
  { date: '2025-11-15', time: '17:30', duration: 45 },
];

function addMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const totalMin = h * 60 + m + minutes;
  const newH = Math.floor(totalMin / 60) % 24;
  const newM = totalMin % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

async function migrate() {
  try {
    console.log(`Migrating ${data.length} Swimming lessons for Zara...`);

    const logs = data.map(row => ({
      date: new Date(row.date + 'T00:00:00Z'),
      startTime: row.time,
      endTime: row.duration > 0 ? addMinutes(row.time, row.duration) : null,
      status: 'attended',
      activityId: 'fd6fe4e3-9eeb-44e8-8eef-652eeceefc24', // Swimming (Zara, Coach Reuben)
      childId: 'b36f95f8-6bc3-4bcc-8b33-10a865fdc786', // Zara
      instructorName: 'Coach Reuben',
      lessonType: 'Normal',
      sentBy: 'Zeya',
      fetcher: 'Zeya',
      durationMinutes: row.duration > 0 ? row.duration : null,
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
