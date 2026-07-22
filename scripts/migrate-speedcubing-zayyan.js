import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Speedcubing (Coach Daryl, at-home 1:1) for Zayyan.
// trial: true → lessonType "Trial", else "Normal". Sender/fetcher null (coach comes home).
const data = [
  { date: '2026-03-20', time: '11:00', duration: 60 },
  { date: '2026-03-02', time: '15:30', duration: 60 },
  { date: '2026-02-12', time: '17:00', duration: 60 },
  { date: '2026-01-28', time: '17:00', duration: 60 },
  { date: '2026-01-14', time: '17:00', duration: 60 },
  { date: '2025-12-03', time: '12:30', duration: 60 },
  { date: '2025-11-12', time: '16:00', duration: 60 },
  { date: '2025-10-22', time: '17:00', duration: 60 },
  { date: '2025-09-25', time: '13:00', duration: 60 },
  { date: '2025-09-11', time: '10:00', duration: 60 },
  { date: '2025-08-27', time: '14:30', duration: 60 },
  { date: '2025-08-16', time: '13:00', duration: 60 },
  { date: '2025-07-30', time: '16:00', duration: 60 },
  { date: '2025-07-02', time: '16:00', duration: 60 },
  { date: '2025-06-18', time: '11:00', duration: 60 },
  { date: '2025-05-16', time: '16:30', duration: 60, trial: true },
];

function addMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

async function migrate() {
  try {
    console.log(`Migrating ${data.length} Speedcubing lessons for Zayyan...`);

    const logs = data.map(row => ({
      date: new Date(row.date + 'T00:00:00Z'),
      startTime: row.time,
      endTime: addMinutes(row.time, row.duration),
      status: 'attended',
      activityId: 'cmrawrp3b000d4qthv6ucna47', // Speedcubing (Zayyan)
      childId: '79b47f32-639f-4953-92b4-e4849971e17d', // Zayyan
      instructorName: 'Coach Daryl',
      lessonType: row.trial ? 'Trial' : 'Normal',
      durationMinutes: row.duration,
      // sentBy / fetcher null — coach comes to our home
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
