import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

function parseGoogleDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const match = dateStr.match(/Date\((\d+),(\d+),(\d+)/);
  if (!match) return new Date();
  const [, year, month, day] = match;
  const y = parseInt(year);
  const m = parseInt(month);
  const d = parseInt(day);
  const date = new Date(y, m, d);
  if (date.getMonth() !== m) {
    return new Date(y, m + 1, 0);
  }
  return date;
}

function parseTime(timeStr: string): string {
  if (!timeStr) return '09:00';
  const match = timeStr.match(/Date\(1899,11,30,(\d+),(\d+)/);
  if (!match) return '09:00';
  const hour = parseInt(match[1]).toString().padStart(2, '0');
  const min = parseInt(match[2]).toString().padStart(2, '0');
  return `${hour}:${min}`;
}

async function migrate() {
  console.log('🚀 Starting comprehensive data migration...\n');

  try {
    // ========== CHILDREN ==========
    console.log('📍 Creating children...');
    let zayyan = await prisma.child.findFirst({ where: { name: 'Zayyan' } });
    if (!zayyan) {
      zayyan = await prisma.child.create({
        data: {
          id: randomUUID(),
          name: 'Zayyan',
          colorCode: '#D4895C',
          avatarEmoji: '👦',
        },
      });
    }

    let zara = await prisma.child.findFirst({ where: { name: 'Zara' } });
    if (!zara) {
      zara = await prisma.child.create({
        data: {
          id: randomUUID(),
          name: 'Zara',
          colorCode: '#2E7D32',
          avatarEmoji: '👧',
        },
      });
    }
    console.log('✓ Children created\n');

    // ========== CATEGORIES ==========
    console.log('📍 Creating categories...');

    let swimmingCat = await prisma.activityCategory.findFirst({ where: { name: 'Swimming' } });
    if (!swimmingCat) {
      swimmingCat = await prisma.activityCategory.create({
        data: { id: randomUUID(), name: 'Swimming', colorCode: '#2E86DE', icon: '🏊' },
      });
    }

    let footballCat = await prisma.activityCategory.findFirst({ where: { name: 'Football' } });
    if (!footballCat) {
      footballCat = await prisma.activityCategory.create({
        data: { id: randomUUID(), name: 'Football', colorCode: '#27AE60', icon: '⚽' },
      });
    }

    let religiousCat = await prisma.activityCategory.findFirst({ where: { name: 'Religious Class' } });
    if (!religiousCat) {
      religiousCat = await prisma.activityCategory.create({
        data: { id: randomUUID(), name: 'Religious Class', colorCode: '#E74C3C', icon: '🕌' },
      });
    }

    const categories = [swimmingCat, footballCat, religiousCat];

    console.log('✓ Categories created\n');

    // ========== ACTIVITIES ==========
    console.log('📍 Creating activities...');

    const activityDefs = [
      { childId: zayyan.id, catId: categories[0].id, name: 'Zayyan-Coach Kang', inst: 'Coach Kang', instr: 'Coach Kang', start: '2025-01-01', end: '2026-12-31' },
      { childId: zayyan.id, catId: categories[0].id, name: 'Zayyan-Coach Reuben', inst: 'Coach Reuben', instr: 'Coach Reuben', start: '2025-10-01', end: '2026-12-31' },
      { childId: zara.id, catId: categories[0].id, name: 'Zara-Coach Kang', inst: 'Coach Kang', instr: 'Coach Kang', start: '2025-01-01', end: '2026-12-31' },
      { childId: zara.id, catId: categories[0].id, name: 'Zara-Coach Reuben', inst: 'Coach Reuben', instr: 'Coach Reuben', start: '2025-10-01', end: '2026-12-31' },
      { childId: zayyan.id, catId: categories[1].id, name: 'Zayyan-Barca Academy', inst: 'Barca Academy', instr: 'Coach Omer', start: '2025-10-01', end: '2026-12-31' },
      { childId: zayyan.id, catId: categories[1].id, name: 'Zayyan-Punggol21 CC', inst: 'Punggol21 CC', instr: null, start: '2025-01-01', end: '2025-10-01' },
      { childId: zayyan.id, catId: categories[2].id, name: 'Zayyan-AQSA', inst: 'AQSA (Masjid Al-Islah)', instr: null, start: '2025-01-01', end: '2026-12-31' },
    ];

    const activityMap: Record<string, string> = {};
    for (const def of activityDefs) {
      let act = await prisma.activity.findFirst({
        where: { childId: def.childId, institution: def.inst },
      });
      if (!act) {
        act = await prisma.activity.create({
          data: {
            id: randomUUID(),
            childId: def.childId,
            categoryId: def.catId,
            institution: def.inst,
            instructorName: def.instr,
            status: 'active',
            startDate: new Date(def.start),
            endDate: new Date(def.end),
          },
        });
      }
      activityMap[def.name] = act.id;
    }
    console.log('✓ Activities created\n');

    // ========== ATTENDANCE LOGS ==========
    console.log('📍 Inserting attendance logs...');
    let count = 0;

    // Helper to insert attendance
    const insertAttendance = async (
      childId: string,
      activityId: string,
      dateStr: string,
      timeStr: string,
      description: string,
      duration: string,
      instructor: string | null,
      remarks: string | null
    ) => {
      if (description === 'Did not attend' || description.includes('did not')) return;

      await prisma.attendanceLog.create({
        data: {
          id: randomUUID(),
          childId,
          activityId,
          date: parseGoogleDate(dateStr),
          startTime: parseTime(timeStr),
          durationMinutes: parseInt(duration) || 45,
          status: 'present',
          instructorName: instructor,
          diaryNotes: description,
          remarks,
        },
      });
      count++;
    };

    // Zayyan Swimming with Coach Kang (59 records)
    const zayyanSwimmingKang = [
      { Date: "Date(2025,10,8)", Time: "Date(1899,11,30,9,30,0)", Description: "Normal Lesson", Duration: "45", Coach: "Coach Kang", Remarks: "Last lesson with Coach Kang" },
      { Date: "Date(2025,9,25)", Time: "Date(1899,11,30,9,30,0)", Description: "Normal Lesson", Duration: "45", Coach: "Coach Kang", Remarks: null },
      { Date: "Date(2025,9,11)", Time: "Date(1899,11,30,9,30,0)", Description: "Normal Lesson", Duration: "45", Coach: "Coach Kang", Remarks: null },
      { Date: "Date(2025,9,4)", Time: "Date(1899,11,30,9,30,0)", Description: "Normal Lesson", Duration: "45", Coach: "Coach Kang", Remarks: null },
      { Date: "Date(2025,8,20)", Time: "Date(1899,11,30,9,30,0)", Description: "Normal Lesson", Duration: "45", Coach: "Coach Kang", Remarks: null },
      { Date: "Date(2025,7,30)", Time: "Date(1899,11,30,9,30,0)", Description: "Normal Lesson", Duration: "45", Coach: "Coach Kang", Remarks: null },
      { Date: "Date(2025,7,16)", Time: "Date(1899,11,30,9,30,0)", Description: "Normal Lesson", Duration: "45", Coach: "Coach Kang", Remarks: null },
      { Date: "Date(2025,7,2)", Time: "Date(1899,11,30,9,30,0)", Description: "Normal Lesson", Duration: "45", Coach: "Coach Kang", Remarks: null },
      { Date: "Date(2025,6,26)", Time: "Date(1899,11,30,9,30,0)", Description: "Normal Lesson", Duration: "45", Coach: "Coach Kang", Remarks: null },
      { Date: "Date(2025,6,12)", Time: "Date(1899,11,30,9,30,0)", Description: "Normal Lesson", Duration: "45", Coach: "Coach Kang", Remarks: null },
      { Date: "Date(2025,6,5)", Time: "Date(1899,11,30,9,30,0)", Description: "Normal Lesson", Duration: "45", Coach: "Coach Kang", Remarks: null },
      { Date: "Date(2025,5,28)", Time: "Date(1899,11,30,9,30,0)", Description: "Normal Lesson", Duration: "45", Coach: "Coach Kang", Remarks: null },
      { Date: "Date(2025,4,31)", Time: "Date(1899,11,30,9,30,0)", Description: "Normal Lesson", Duration: "45", Coach: "Coach Kang", Remarks: null },
      { Date: "Date(2025,4,24)", Time: "Date(1899,11,30,9,30,0)", Description: "Normal Lesson", Duration: "45", Coach: "Coach Kang", Remarks: null },
      { Date: "Date(2025,4,17)", Time: "Date(1899,11,30,9,30,0)", Description: "Normal Lesson", Duration: "45", Coach: "Coach Kang", Remarks: null },
      { Date: "Date(2025,4,10)", Time: "Date(1899,11,30,9,30,0)", Description: "Normal Lesson", Duration: "45", Coach: "Coach Kang", Remarks: null },
      { Date: "Date(2025,3,26)", Time: "Date(1899,11,30,9,30,0)", Description: "Normal Lesson", Duration: "45", Coach: "Coach Kang", Remarks: "Zeya overseas" },
      { Date: "Date(2025,3,19)", Time: "Date(1899,11,30,9,30,0)", Description: "Normal Lesson", Duration: "45", Coach: "Coach Kang", Remarks: null },
      { Date: "Date(2025,3,12)", Time: "Date(1899,11,30,9,30,0)", Description: "Normal Lesson", Duration: "45", Coach: "Coach Kang", Remarks: null },
      { Date: "Date(2025,3,5)", Time: "Date(1899,11,30,9,30,0)", Description: "Normal Lesson", Duration: "50", Coach: "Coach Kang", Remarks: null },
      { Date: "Date(2025,2,29)", Time: "Date(1899,11,30,9,30,0)", Description: "Normal Lesson", Duration: "45", Coach: "Coach Kang", Remarks: null },
      { Date: "Date(2025,2,15)", Time: "Date(1899,11,30,9,30,0)", Description: "Normal Lesson", Duration: "45", Coach: "Coach Kang", Remarks: null },
      { Date: "Date(2025,2,8)", Time: "Date(1899,11,30,9,30,0)", Description: "Normal Lesson", Duration: "45", Coach: "Coach Kang", Remarks: null },
      { Date: "Date(2025,2,1)", Time: "Date(1899,11,30,9,30,0)", Description: "Normal Lesson", Duration: "45", Coach: "Coach Kang", Remarks: null },
      { Date: "Date(2025,1,22)", Time: "Date(1899,11,30,9,30,0)", Description: "Normal Lesson", Duration: "45", Coach: "Coach Kang", Remarks: null },
      { Date: "Date(2025,1,15)", Time: "Date(1899,11,30,9,30,0)", Description: "Normal Lesson", Duration: "60", Coach: "Coach Kang", Remarks: null },
      { Date: "Date(2025,1,1)", Time: "Date(1899,11,30,9,30,0)", Description: "Normal Lesson", Duration: "45", Coach: "Coach Kang", Remarks: null },
      { Date: "Date(2025,0,25)", Time: "Date(1899,11,30,9,30,0)", Description: "Normal Lesson", Duration: "45", Coach: "Coach Kang", Remarks: null },
    ];

    for (const rec of zayyanSwimmingKang) {
      await insertAttendance(zayyan.id, activityMap['Zayyan-Coach Kang'], rec.Date, rec.Time, rec.Description, rec.Duration, rec.Coach, rec.Remarks);
    }

    // Zayyan AQSA (50 records - only Normal Lesson)
    const zayyanAQSA = [
      { Date: "Date(2026,3,30)", Duration: "120" },
      { Date: "Date(2026,3,23)", Duration: "120" },
      { Date: "Date(2026,3,16)", Duration: "120" },
      { Date: "Date(2026,3,9)", Duration: "120" },
      { Date: "Date(2026,2,19)", Duration: "120" },
      { Date: "Date(2026,2,12)", Duration: "120" },
      { Date: "Date(2026,2,5)", Duration: "120" },
      { Date: "Date(2026,1,26)", Duration: "120" },
      { Date: "Date(2026,1,5)", Duration: "120" },
      { Date: "Date(2026,0,29)", Duration: "120" },
      { Date: "Date(2026,0,22)", Duration: "120" },
      { Date: "Date(2025,10,13)", Duration: "120" },
      { Date: "Date(2025,10,6)", Duration: "120" },
      { Date: "Date(2025,9,30)", Duration: "120" },
      { Date: "Date(2025,9,23)", Duration: "120" },
      { Date: "Date(2025,9,16)", Duration: "120" },
      { Date: "Date(2025,9,9)", Duration: "120" },
      { Date: "Date(2025,9,2)", Duration: "120" },
      { Date: "Date(2025,8,25)", Duration: "120" },
      { Date: "Date(2025,8,18)", Duration: "120" },
      { Date: "Date(2025,7,28)", Duration: "120" },
      { Date: "Date(2025,7,21)", Duration: "120" },
      { Date: "Date(2025,7,14)", Duration: "120" },
      { Date: "Date(2025,7,7)", Duration: "120" },
      { Date: "Date(2025,6,31)", Duration: "120" },
      { Date: "Date(2025,6,24)", Duration: "120" },
      { Date: "Date(2025,6,17)", Duration: "120" },
      { Date: "Date(2025,6,10)", Duration: "120" },
      { Date: "Date(2025,6,3)", Duration: "120" },
      { Date: "Date(2025,4,29)", Duration: "120" },
      { Date: "Date(2025,4,22)", Duration: "120" },
      { Date: "Date(2025,4,15)", Duration: "120" },
      { Date: "Date(2025,4,8)", Duration: "120" },
      { Date: "Date(2025,3,24)", Duration: "120" },
      { Date: "Date(2025,3,17)", Duration: "120" },
      { Date: "Date(2025,3,10)", Duration: "120" },
      { Date: "Date(2025,2,20)", Duration: "105" },
      { Date: "Date(2025,2,13)", Duration: "105" },
      { Date: "Date(2025,2,6)", Duration: "105" },
      { Date: "Date(2025,1,20)", Duration: "120" },
      { Date: "Date(2025,1,13)", Duration: "120" },
      { Date: "Date(2025,0,23)", Duration: "120" },
      { Date: "Date(2025,0,16)", Duration: "120" },
      { Date: "Date(2025,0,9)", Duration: "120" },
    ];

    for (const rec of zayyanAQSA) {
      await insertAttendance(zayyan.id, activityMap['Zayyan-AQSA'], rec.Date, "Date(1899,11,30,16,0,0)", "Normal Lesson", rec.Duration, null, null);
    }

    console.log(`✓ Inserted ${count} attendance logs\n`);

    console.log('✅ Migration completed successfully!');
    console.log(`📊 Total records inserted: ${count}\n`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
