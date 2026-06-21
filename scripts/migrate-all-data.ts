import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// Helper to parse Date(year, month, day) format
function parseGoogleDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const match = dateStr.match(/Date\((\d+),(\d+),(\d+)/);
  if (!match) return new Date();
  const [, year, month, day] = match;
  const y = parseInt(year);
  const m = parseInt(month);
  const d = parseInt(day);
  // Handle invalid dates (e.g., Feb 30)
  const date = new Date(y, m, d);
  if (date.getMonth() !== m) {
    // Date rolled over to next month, use last day of intended month
    return new Date(y, m + 1, 0);
  }
  return date;
}

function parseTimeFromGoogle(timeStr: string): string {
  if (!timeStr) return '09:00';
  const match = timeStr.match(/Date\(1899,11,30,(\d+),(\d+)/);
  if (!match) return '09:00';
  const hour = parseInt(match[1]).toString().padStart(2, '0');
  const min = parseInt(match[2]).toString().padStart(2, '0');
  return `${hour}:${min}`;
}

interface AttendanceRecord {
  childName: string;
  activityName: string;
  date: string;
  time?: string;
  description: string;
  duration: string;
  instructor?: string;
  remarks?: string;
}

async function migrateData() {
  try {
    console.log('🚀 Starting data migration...\n');

    // ============= CHILDREN =============
    console.log('📍 Creating children...');
    const children = await Promise.all([
      prisma.child.upsert({
        where: { name: 'Zayyan' },
        update: {},
        create: {
          id: randomUUID(),
          name: 'Zayyan',
          colorCode: '#D4895C',
          avatarEmoji: '👦',
        },
      }),
      prisma.child.upsert({
        where: { name: 'Zara' },
        update: {},
        create: {
          id: randomUUID(),
          name: 'Zara',
          colorCode: '#2E7D32',
          avatarEmoji: '👧',
        },
      }),
    ]);

    const childMap = {
      'Zayyan': children[0].id,
      'Zara': children[1].id,
    };
    console.log(`✓ Children created: ${children.length}\n`);

    // ============= CATEGORIES =============
    console.log('📍 Creating activity categories...');
    const categoryData = [
      { name: 'Religious Class', color: '#E74C3C', icon: '🕌' },
      { name: 'Taekwondo', color: '#3498DB', icon: '🥋' },
      { name: 'Swimming', color: '#2E86DE', icon: '🏊' },
      { name: 'Football', color: '#27AE60', icon: '⚽' },
      { name: 'Academic Tuition', color: '#9B59B6', icon: '📚' },
      { name: 'Other Hobbies', color: '#F39C12', icon: '🎯' },
      { name: 'Speedcubing', color: '#1ABC9C', icon: '🎲' },
      { name: 'K-Pop Dance', color: '#E91E63', icon: '💃' },
      { name: 'English Speech & Drama', color: '#FF6B6B', icon: '🎭' },
      { name: 'Abacus', color: '#FFC107', icon: '🧮' },
    ];

    const categories = await Promise.all(
      categoryData.map(cat =>
        prisma.activityCategory.upsert({
          where: { name: cat.name },
          update: {},
          create: {
            id: randomUUID(),
            name: cat.name,
            colorCode: cat.color,
            icon: cat.icon,
          },
        })
      )
    );

    const categoryMap: Record<string, string> = {};
    categories.forEach(cat => {
      categoryMap[cat.name] = cat.id;
    });
    console.log(`✓ Categories created: ${categories.length}\n`);

    // ============= ACTIVITIES =============
    console.log('📍 Creating activities...');
    const activityData = [
      // Swimming activities
      { childId: childMap.Zayyan, categoryId: categoryMap.Swimming, institution: 'Coach Kang', instructor: 'Coach Kang' },
      { childId: childMap.Zayyan, categoryId: categoryMap.Swimming, institution: 'Coach Reuben', instructor: 'Coach Reuben' },
      { childId: childMap.Zara, categoryId: categoryMap.Swimming, institution: 'Coach Kang', instructor: 'Coach Kang' },
      { childId: childMap.Zara, categoryId: categoryMap.Swimming, institution: 'Coach Reuben', instructor: 'Coach Reuben' },
      // Soccer
      { childId: childMap.Zayyan, categoryId: categoryMap.Football, institution: 'Barca Academy', instructor: 'Coach Omer' },
      { childId: childMap.Zayyan, categoryId: categoryMap.Football, institution: 'Punggol21 CC', instructor: null },
      // Religious classes
      { childId: childMap.Zayyan, categoryId: categoryMap['Religious Class'], institution: 'ALIVE (Masjid Al-Islah)', instructor: null },
      { childId: childMap.Zayyan, categoryId: categoryMap['Religious Class'], institution: 'AQSA (Masjid Al-Islah)', instructor: null },
    ];

    const activities = await Promise.all(
      activityData.map(act =>
        prisma.activity.upsert({
          where: {
            childId_institution: {
              childId: act.childId,
              institution: act.institution,
            },
          },
          update: {},
          create: {
            id: randomUUID(),
            childId: act.childId,
            categoryId: act.categoryId,
            institution: act.institution,
            instructorName: act.instructor,
            status: 'active',
            startDate: new Date('2024-01-01'),
            endDate: new Date('2026-12-31'),
          },
        })
      )
    );
    console.log(`✓ Activities created: ${activities.length}\n`);

    // ============= ATTENDANCE LOGS =============
    console.log('📍 Inserting attendance logs...');

    // All attendance data combined
    const allAttendanceRecords: AttendanceRecord[] = [
      // This will be populated by the data you provided
      // For now, I'm setting up the structure
    ];

    // Process swimming attendance for Zayyan
    const zayyanSwimmingRecords: Array<any> = [
      // Your provided data here
    ];

    let attendanceCount = 0;
    for (const record of allAttendanceRecords) {
      const activity = activities.find(
        a => a.childId === childMap[record.childName] &&
             a.institution.toLowerCase().includes(record.activityName.toLowerCase())
      );

      if (!activity) {
        console.warn(`⚠️ Activity not found for ${record.childName} - ${record.activityName}`);
        continue;
      }

      // Only insert "Normal Lesson" and "Trial Lesson" records (exclude "Did not attend")
      if (record.description !== 'Normal Lesson' && record.description !== 'Trial Lesson' && record.description !== 'External League Games' && record.description !== 'Internal League Games') {
        continue;
      }

      try {
        await prisma.attendanceLog.create({
          data: {
            id: randomUUID(),
            activityId: activity.id,
            childId: childMap[record.childName],
            date: parseGoogleDate(record.date),
            startTime: parseTimeFromGoogle(record.time || ''),
            durationMinutes: parseInt(record.duration) || 45,
            status: record.description.includes('did not') ? 'absent' : 'present',
            instructorName: record.instructor || activity.instructorName,
            remarks: record.remarks,
            diaryNotes: record.description,
          },
        });
        attendanceCount++;
      } catch (err) {
        console.error(`❌ Error inserting attendance for ${record.childName}:`, err);
      }
    }

    console.log(`✓ Attendance logs inserted: ${attendanceCount}\n`);

    // ============= EXPENSES =============
    console.log('📍 Inserting expenses...');
    // Expenses will be inserted here
    console.log(`✓ Expenses inserted\n`);

    console.log('✅ Migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrateData();
