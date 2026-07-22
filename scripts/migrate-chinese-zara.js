import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Chinese Tuition (Berries, 陈老师) for Zara. 14:30, 105 min attended lessons.
// absent: 'Cancelled' | 'Overseas' marks a non-attended session. Term column ignored.
const data = [
  { date: '2026-05-27', lesson: 21, level: null },
  { date: '2026-05-20', lesson: 20, level: null },
  { date: '2026-05-13', lesson: 19, level: null },
  { date: '2026-05-06', lesson: 18, level: null },
  { date: '2026-04-29', lesson: 17, level: 'K2' },
  { date: '2026-04-22', lesson: 16, level: 'K2' },
  { date: '2026-04-16', lesson: 15, level: 'K2' },
  { date: '2026-04-08', lesson: 14, level: 'K2' },
  { date: '2026-04-01', lesson: 13, level: 'K2' },
  { date: '2026-03-25', lesson: 12, level: 'K2' },
  { date: '2026-03-18', lesson: 11, level: 'K2' },
  { date: '2026-03-11', lesson: 10, level: 'K2' },
  { date: '2026-03-04', lesson: 9, level: 'K2' },
  { date: '2026-02-25', lesson: 8, level: 'K2' },
  { date: '2026-02-18', lesson: null, level: 'K2', absent: 'Cancelled' }, // CNY Break
  { date: '2026-02-11', lesson: 7, level: 'K2' },
  { date: '2026-02-04', lesson: 6, level: 'K2', absent: 'Overseas' }, // In Taiwan
  { date: '2026-01-28', lesson: 5, level: 'K2' },
  { date: '2026-01-21', lesson: 4, level: 'K2' },
  { date: '2026-01-14', lesson: 3, level: 'K2' },
  { date: '2026-01-07', lesson: 2, level: 'K2' },
  { date: '2025-12-31', lesson: 1, level: 'K2' },
];

async function migrate() {
  try {
    console.log(`Migrating ${data.length} Chinese Tuition records for Zara...`);

    const logs = data.map(row => ({
      date: new Date(row.date + 'T00:00:00Z'),
      startTime: '14:30',
      endTime: row.absent ? null : '16:15',
      status: row.absent ? 'absent' : 'attended',
      activityId: 'cmqrze2th0001tky207g7a867', // Chinese Tuition (Zara)
      childId: 'b36f95f8-6bc3-4bcc-8b33-10a865fdc786', // Zara
      instructorName: '陈老师',
      lessonType: row.absent ? null : 'Normal',
      level: row.level,
      lessonNumber: row.lesson,
      durationMinutes: row.absent ? null : 105,
      absenceReason: row.absent ?? null,
      // sentBy / fetcher left blank
    }));

    const result = await prisma.attendanceLog.createMany({
      data: logs,
      skipDuplicates: true,
    });

    const attended = data.filter(d => !d.absent).length;
    const absent = data.filter(d => d.absent).length;
    console.log(`✓ Created ${result.count} records (${attended} attended, ${absent} absent)`);
    await prisma.$disconnect();
  } catch (err) {
    console.error('Migration failed:', err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

migrate();
