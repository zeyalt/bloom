import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// aLIVE Madrasah lessons for Zayyan (2025, Ustazah Shahirah) — "Did not attend" rows omitted.
const data = [
  { date: '2025-11-11', time: '15:00', duration: 180 },
  { date: '2025-11-04', time: '15:00', duration: 180 },
  { date: '2025-10-28', time: '15:00', duration: 180 },
  { date: '2025-10-21', time: '15:00', duration: 180 },
  { date: '2025-10-14', time: '15:00', duration: 180 },
  { date: '2025-10-07', time: '15:00', duration: 180 },
  { date: '2025-09-30', time: '15:00', duration: 180 },
  { date: '2025-09-23', time: '15:00', duration: 180 },
  { date: '2025-09-16', time: '15:00', duration: 180 },
  { date: '2025-09-02', time: '15:00', duration: 180 },
  { date: '2025-08-26', time: '15:00', duration: 180 },
  { date: '2025-08-19', time: '15:00', duration: 180 },
  { date: '2025-08-05', time: '15:00', duration: 180 },
  { date: '2025-07-29', time: '15:00', duration: 180 },
  { date: '2025-07-22', time: '15:00', duration: 180 },
  { date: '2025-07-15', time: '15:00', duration: 180 },
  { date: '2025-07-08', time: '15:00', duration: 180 },
  { date: '2025-07-01', time: '15:00', duration: 180 },
  { date: '2025-05-20', time: '15:00', duration: 180 },
  { date: '2025-05-13', time: '15:00', duration: 180 },
  { date: '2025-05-06', time: '15:00', duration: 180 },
  { date: '2025-04-29', time: '15:00', duration: 180 },
  { date: '2025-04-22', time: '15:00', duration: 180 },
  { date: '2025-04-15', time: '15:00', duration: 180 },
  { date: '2025-04-08', time: '15:00', duration: 180 },
  { date: '2025-04-01', time: '15:00', duration: 180 },
  { date: '2025-03-25', time: '15:00', duration: 150 },
  { date: '2025-03-18', time: '15:00', duration: 150 },
  { date: '2025-03-11', time: '15:00', duration: 150 },
  { date: '2025-03-04', time: '15:00', duration: 150 },
  { date: '2025-02-25', time: '15:00', duration: 180 },
  { date: '2025-02-18', time: '15:00', duration: 180 },
  { date: '2025-02-04', time: '15:00', duration: 180 },
  { date: '2025-01-28', time: '15:00', duration: 180 },
  { date: '2025-01-21', time: '15:00', duration: 180 },
];

function addMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

async function migrate() {
  try {
    console.log(`Migrating ${data.length} aLIVE Madrasah (2025) lessons for Zayyan...`);

    const logs = data.map(row => ({
      date: new Date(row.date + 'T00:00:00Z'),
      startTime: row.time,
      endTime: addMinutes(row.time, row.duration),
      status: 'attended',
      activityId: 'cmraw4kwf000b4qthuet3teox', // aLIVE Madrasah (Zayyan, Ustazah Shahirah)
      childId: '79b47f32-639f-4953-92b4-e4849971e17d', // Zayyan
      instructorName: 'Ustazah Shahirah',
      lessonType: 'Normal',
      level: 'Kids 3T',
      durationMinutes: row.duration,
      sentBy: 'Helper',
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
