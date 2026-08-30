import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Chinese Tuition (Berries, 许老师) for Zayyan — 2024, K2, held at Downtown East.
// The K2 activity already exists (created with the 2024 school year); this only
// fills in its lessons and corrects its instructor name.
const ACTIVITY = 'cmrl2s915000l4qthi0vetoac';
const CHILD = '79b47f32-639f-4953-92b4-e4849971e17d';
const LEVEL = 'K2';
const LOCATION = 'Downtown East';
const INSTRUCTOR = '许老师';

// Defaults: time 17:00, type Normal, duration 100 min. Override per row.
// `absent: reason` marks a missed lesson (no duration); unlike the 2023 sheet,
// these absences carry lesson numbers, so they keep them.
const data = [
  { date: '2024-12-02', lesson: 46 },
  { date: '2024-11-25', lesson: 45 },
  { date: '2024-11-18', lesson: 44 },
  { date: '2024-11-11', lesson: 43 },
  { date: '2024-11-04', lesson: 42 },
  { date: '2024-10-28', lesson: 41 },
  { date: '2024-10-21', lesson: 40 },
  { date: '2024-10-14', lesson: 39 },
  { date: '2024-10-07', lesson: 38 },
  { date: '2024-09-30', lesson: 37, absent: 'Overseas (NZ)' },
  { date: '2024-09-23', lesson: 36, absent: 'Overseas (NZ)' },
  { date: '2024-09-16', lesson: 35, absent: 'Overseas (NZ)' },
  { date: '2024-09-09', lesson: 34, absent: 'Overseas (NZ)' },
  { date: '2024-09-02', lesson: 33, absent: 'Overseas (NZ)' },
  { date: '2024-08-26', lesson: 32, absent: 'Overseas (NZ)' },
  { date: '2024-08-19', lesson: 31, absent: 'Overseas (NZ)' },
  { date: '2024-08-12', lesson: 30, absent: 'Overseas (NZ)' },
  { date: '2024-08-10', lesson: 29, time: '18:45' },
  { date: '2024-07-29', lesson: 28 },
  { date: '2024-07-27', lesson: 27, time: '16:45', type: 'Replacement', remarks: 'Make-up for 22 Jul 2024' },
  { date: '2024-07-22', absent: 'Unwell' },
  { date: '2024-07-15', lesson: 26 },
  { date: '2024-07-08', lesson: 25 },
  { date: '2024-07-01', lesson: 24 },
  { date: '2024-06-24', lesson: 23 },
  { date: '2024-06-03', lesson: 22 },
  { date: '2024-05-27', lesson: 21 },
  { date: '2024-05-20', lesson: 20 },
  { date: '2024-05-13', lesson: 19 },
  { date: '2024-05-06', lesson: 18 },
  { date: '2024-04-29', lesson: 17 },
  { date: '2024-04-22', lesson: 16 },
  { date: '2024-04-15', lesson: 15 },
  { date: '2024-04-08', lesson: 14 },
  { date: '2024-04-01', lesson: 13 },
  { date: '2024-03-25', lesson: 12 },
  { date: '2024-03-18', lesson: 11 },
  { date: '2024-03-11', lesson: 10 },
  { date: '2024-03-04', lesson: 9 },
  { date: '2024-02-26', lesson: 8 },
  { date: '2024-02-19', lesson: 7 },
  { date: '2024-02-05', lesson: 6 },
  { date: '2024-01-29', lesson: 5 },
  { date: '2024-01-22', lesson: 4 },
  { date: '2024-01-15', lesson: 3 },
  { date: '2024-01-08', lesson: 2 },
  { date: '2024-01-03', lesson: 1, type: 'Replacement', remarks: 'Make-up for 1 Jan 2024' },
];

function addMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

async function migrate() {
  try {
    // Re-running would duplicate every row — attendance logs have no natural
    // unique key — so bail out if this activity already has lessons.
    const existing = await prisma.attendanceLog.count({ where: { activityId: ACTIVITY } });
    if (existing) {
      console.error(`✗ Activity ${ACTIVITY} already has ${existing} logs — nothing to do.`);
      await prisma.$disconnect();
      process.exit(1);
    }

    await prisma.activity.update({
      where: { id: ACTIVITY },
      data: { instructorName: INSTRUCTOR },
    });

    const logs = data.map(row => {
      const time = row.time ?? '17:00';
      const duration = row.absent !== undefined ? null : (row.duration ?? 100);
      return {
        date: new Date(row.date + 'T00:00:00Z'),
        startTime: time,
        endTime: duration ? addMinutes(time, duration) : null,
        status: row.absent !== undefined ? 'absent' : 'attended',
        activityId: ACTIVITY,
        childId: CHILD,
        instructorName: INSTRUCTOR,
        lessonType: row.absent !== undefined ? null : (row.type ?? 'Normal'),
        level: LEVEL,
        location: LOCATION,
        lessonNumber: row.lesson ?? null,
        durationMinutes: duration,
        absenceReason: row.absent ?? null,
        remarks: row.remarks ?? null,
        // sentBy / fetcher left blank
      };
    });

    const result = await prisma.attendanceLog.createMany({ data: logs });
    const absent = data.filter(d => d.absent !== undefined).length;
    console.log(`✓ Created ${result.count} records (${data.length - absent} attended, ${absent} absent)`);
    await prisma.$disconnect();
  } catch (err) {
    console.error('Migration failed:', err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

migrate();
