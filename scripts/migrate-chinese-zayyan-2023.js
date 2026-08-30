import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Chinese Tuition (Berries, 许老师) for Zayyan — 2023, K1, held at Downtown East.
// Each school year is its own activity record (K1 → K2 → P1 → P2); this script
// creates the K1 one, which didn't exist yet, then loads its lessons.
const CHILD = '79b47f32-639f-4953-92b4-e4849971e17d';
const CATEGORY = '3869d871-e6bb-4237-877b-0ba57c0a27be';
const LEVEL = 'K1';
const LOCATION = 'Downtown East';
const INSTRUCTOR = '许老师';

// Defaults: time 17:00, type Normal, duration 100 min. Override per row.
// `absent: reason` marks a missed lesson (no lesson number, no duration);
// an empty string means the sheet gave no reason.
const data = [
  { date: '2023-12-25', lesson: 46 },
  { date: '2023-12-18', lesson: 45 },
  { date: '2023-12-11', lesson: 44 },
  { date: '2023-12-04', lesson: 43 },
  { date: '2023-11-27', lesson: 42 },
  { date: '2023-11-20', lesson: 41 },
  { date: '2023-11-13', lesson: 40 },
  { date: '2023-11-08', lesson: 39 },
  { date: '2023-11-01', lesson: 38 },
  { date: '2023-10-23', lesson: 37 },
  { date: '2023-10-16', lesson: 36 },
  { date: '2023-10-10', lesson: 35, time: '15:15', type: 'Replacement', remarks: 'MC' },
  { date: '2023-09-20', absent: '' },
  { date: '2023-09-11', lesson: 34 },
  { date: '2023-09-04', lesson: 33 },
  { date: '2023-08-27', lesson: 32, time: '14:45', type: 'Replacement', remarks: 'Make-up for 23 Aug 2023' },
  { date: '2023-08-23', absent: 'Overseas (Australia)' },
  { date: '2023-08-16', absent: 'Overseas (Australia)' },
  { date: '2023-08-14', lesson: 31, type: 'Replacement', remarks: 'Make-up for 16 Aug 2023' },
  { date: '2023-08-09', lesson: 30, duration: 30, remarks: 'Online Lesson (National Day)' },
  { date: '2023-08-02', lesson: 29 },
  { date: '2023-07-26', lesson: 28 },
  { date: '2023-07-19', lesson: 27 },
  { date: '2023-07-05', lesson: 25, remarks: 'Trial Class' },
];

function addMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

async function migrate() {
  try {
    // Re-running would duplicate every row — attendance logs have no natural
    // unique key — so bail out if the K1 activity already has lessons.
    const existing = await prisma.activity.findFirst({
      where: { childId: CHILD, institution: 'Berries', level: LEVEL },
      include: { _count: { select: { attendanceLogs: true } } },
    });
    if (existing?._count.attendanceLogs) {
      console.error(`✗ K1 activity ${existing.id} already has ${existing._count.attendanceLogs} logs — nothing to do.`);
      await prisma.$disconnect();
      process.exit(1);
    }

    const dates = data.map(r => r.date).sort();
    const activity = existing ?? await prisma.activity.create({
      data: {
        childId: CHILD,
        categoryId: CATEGORY,
        activityName: 'Chinese Tuition',
        institution: 'Berries',
        instructorName: INSTRUCTOR,
        level: LEVEL,
        status: 'completed',
        startDate: new Date(dates[0] + 'T00:00:00Z'),
        endDate: new Date(dates[dates.length - 1] + 'T00:00:00Z'),
      },
    });
    console.log(`${existing ? 'Using' : 'Created'} K1 activity ${activity.id} (${dates[0]} → ${dates[dates.length - 1]})`);

    const logs = data.map(row => {
      const time = row.time ?? '17:00';
      const duration = row.absent !== undefined ? null : (row.duration ?? 100);
      return {
        date: new Date(row.date + 'T00:00:00Z'),
        startTime: time,
        endTime: duration ? addMinutes(time, duration) : null,
        status: row.absent !== undefined ? 'absent' : 'attended',
        activityId: activity.id,
        childId: CHILD,
        instructorName: INSTRUCTOR,
        lessonType: row.absent !== undefined ? null : (row.type ?? 'Normal'),
        level: LEVEL,
        location: LOCATION,
        lessonNumber: row.lesson ?? null,
        durationMinutes: duration,
        absenceReason: row.absent || null,
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
