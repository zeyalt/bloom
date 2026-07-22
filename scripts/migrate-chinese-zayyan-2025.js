import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Chinese Tuition (Berries, 谢老师) for Zayyan — 2025, held at Downtown East.
const ACTIVITY = 'cmqrzjksf0003dz83ke18a7t2';
const CHILD = '79b47f32-639f-4953-92b4-e4849971e17d';
const LEVEL = 'P1 (Distinction)';
const LOCATION = 'Downtown East';

// Defaults: time 14:45, type Normal, duration 120. Override per row as needed.
const data = [
  { date: '2025-12-01', lesson: 46, remarks: 'Last Lesson' },
  { date: '2025-11-24', lesson: 45 },
  { date: '2025-11-17', lesson: 44 },
  { date: '2025-11-10', lesson: 43 },
  { date: '2025-11-03', lesson: 42 },
  { date: '2025-10-27', lesson: 41 },
  { date: '2025-10-20', lesson: 40 },
  { date: '2025-10-13', lesson: 39 },
  { date: '2025-10-06', lesson: 38 },
  { date: '2025-09-29', lesson: 37 },
  { date: '2025-09-22', lesson: 36 },
  { date: '2025-09-15', lesson: 35 },
  { date: '2025-09-08', lesson: 34 },
  { date: '2025-09-01', lesson: 33 },
  { date: '2025-08-25', lesson: 32 },
  { date: '2025-08-22', lesson: 31, time: '16:00', type: 'Replacement', remarks: 'For 18 Aug Class' },
  { date: '2025-08-11', lesson: 30 },
  { date: '2025-08-04', lesson: 29 },
  { date: '2025-07-28', lesson: 28 },
  { date: '2025-07-21', lesson: 27 },
  { date: '2025-07-14', lesson: 26 },
  { date: '2025-07-11', lesson: 25, time: '16:00', type: 'Replacement' },
  { date: '2025-06-30', lesson: 24 },
  { date: '2025-06-23', lesson: 23 },
  { date: '2025-06-21', lesson: 22, time: '15:30' },
  { date: '2025-05-26', lesson: 21 },
  { date: '2025-05-19', lesson: 20 },
  { date: '2025-05-12', lesson: 19, type: 'Online', remarks: 'Online class (Public Holiday)' },
  { date: '2025-05-05', lesson: 18 },
  { date: '2025-04-28', lesson: 17, remarks: 'Zeya overseas' },
  { date: '2025-04-21', lesson: 16 },
  { date: '2025-04-14', lesson: 15 },
  { date: '2025-04-07', lesson: 14 },
  { date: '2025-03-31', lesson: 13, type: 'Online', duration: null, remarks: 'Online class (Public Holiday)' },
  { date: '2025-03-24', lesson: 12 },
  { date: '2025-03-17', lesson: 11, remarks: 'Oral Test' },
  { date: '2025-03-10', lesson: 10 },
  { date: '2025-03-03', lesson: 9 },
  { date: '2025-02-24', lesson: 8 },
  { date: '2025-02-17', lesson: 7 },
  { date: '2025-02-10', lesson: 6 },
  { date: '2025-02-03', lesson: 5 },
  { date: '2025-01-20', lesson: 4 },
  { date: '2025-01-13', lesson: 3 },
  { date: '2025-01-06', lesson: 2 },
  { date: '2024-12-30', lesson: 1 },
];

function addMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

async function migrate() {
  try {
    console.log(`Migrating ${data.length} Chinese Tuition (2025) records for Zayyan...`);

    const logs = data.map(row => {
      const time = row.time ?? '14:45';
      const duration = row.duration === null ? null : (row.duration ?? 120);
      return {
        date: new Date(row.date + 'T00:00:00Z'),
        startTime: time,
        endTime: duration ? addMinutes(time, duration) : null,
        status: 'attended',
        activityId: ACTIVITY,
        childId: CHILD,
        instructorName: '谢老师',
        lessonType: row.type ?? 'Normal',
        level: LEVEL,
        location: LOCATION,
        lessonNumber: row.lesson,
        durationMinutes: duration,
        remarks: row.remarks ?? null,
        // sentBy / fetcher left blank
      };
    });

    const result = await prisma.attendanceLog.createMany({ data: logs, skipDuplicates: true });
    console.log(`✓ Created ${result.count} records (all at Downtown East)`);
    await prisma.$disconnect();
  } catch (err) {
    console.error('Migration failed:', err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

migrate();
