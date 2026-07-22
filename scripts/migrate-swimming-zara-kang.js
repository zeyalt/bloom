import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Coach Kang's Swimming lessons for Zara — "Did not attend" rows omitted.
const data = [
  { date: '2025-11-08', time: '09:30', duration: 45 },
  { date: '2025-10-25', time: '09:30', duration: 45 },
  { date: '2025-10-11', time: '09:30', duration: 45 },
  { date: '2025-10-04', time: '09:30', duration: 45 },
  { date: '2025-09-20', time: '09:30', duration: 45 },
  { date: '2025-08-30', time: '09:30', duration: 45 },
  { date: '2025-08-16', time: '09:30', duration: 45 },
  { date: '2025-08-02', time: '09:30', duration: 45 },
  { date: '2025-07-26', time: '09:30', duration: 45 },
  { date: '2025-07-19', time: '09:30', duration: 45 },
  { date: '2025-07-12', time: '09:30', duration: 45 },
  { date: '2025-07-05', time: '09:30', duration: 45 },
  { date: '2025-06-28', time: '09:30', duration: 45 },
  { date: '2025-05-31', time: '09:30', duration: 45 },
  { date: '2025-05-24', time: '09:30', duration: 45 },
  { date: '2025-05-17', time: '09:30', duration: 45 },
  { date: '2025-05-10', time: '09:30', duration: 45 },
  { date: '2025-04-26', time: '09:30', duration: 45 },
  { date: '2025-04-19', time: '09:30', duration: 45 },
  { date: '2025-04-12', time: '09:30', duration: 45 },
  { date: '2025-04-05', time: '09:30', duration: 45 },
  { date: '2025-03-29', time: '09:30', duration: 45 },
  { date: '2025-03-15', time: '09:30', duration: 45 },
  { date: '2025-03-08', time: '09:30', duration: 45 },
  { date: '2025-03-01', time: '09:30', duration: 45 },
  { date: '2025-02-22', time: '09:30', duration: 45 },
  { date: '2025-02-15', time: '09:30', duration: 60 },
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
    console.log(`Migrating ${data.length} Coach Kang Swimming lessons for Zara...`);

    const logs = data.map(row => ({
      date: new Date(row.date + 'T00:00:00Z'),
      startTime: row.time,
      endTime: addMinutes(row.time, row.duration),
      status: 'attended',
      activityId: '76773d96-861e-4a00-9423-f7e9b582e2d0', // Swimming (Zara, Coach Kang)
      childId: 'b36f95f8-6bc3-4bcc-8b33-10a865fdc786', // Zara
      instructorName: 'Coach Kang',
      lessonType: 'Normal',
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
