import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clear existing data (optional, remove if you want to preserve data)
  await prisma.sender.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.attendanceLog.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.child.deleteMany();
  await prisma.activityCategory.deleteMany();

  // Create categories
  const categories = await Promise.all([
    prisma.activityCategory.create({
      data: {
        id: 'cat-1',
        name: 'Sports',
        colorCode: '#FF6B6B',
        icon: '⚽',
      },
    }),
    prisma.activityCategory.create({
      data: {
        id: 'cat-2',
        name: 'Arts & Crafts',
        colorCode: '#4ECDC4',
        icon: '🎨',
      },
    }),
    prisma.activityCategory.create({
      data: {
        id: 'cat-3',
        name: 'Education',
        colorCode: '#45B7D1',
        icon: '📚',
      },
    }),
    prisma.activityCategory.create({
      data: {
        id: 'cat-4',
        name: 'Music',
        colorCode: '#FFA500',
        icon: '🎵',
      },
    }),
    prisma.activityCategory.create({
      data: {
        id: 'cat-5',
        name: 'Languages',
        colorCode: '#9B59B6',
        icon: '🌍',
      },
    }),
  ]);

  console.log(`Created ${categories.length} categories`);

  // Create children
  const children = await Promise.all([
    prisma.child.create({
      data: {
        id: 'child-1',
        name: 'Zayyan',
        nickname: 'Zay',
        dateOfBirth: new Date('2015-03-15'),
        school: 'Al Noor School',
        colorCode: '#D4895C',
        avatarEmoji: '👦',
      },
    }),
    prisma.child.create({
      data: {
        id: 'child-2',
        name: 'Zara',
        nickname: 'Z',
        dateOfBirth: new Date('2018-07-22'),
        school: 'Bright Minds Academy',
        colorCode: '#2E7D32',
        avatarEmoji: '👧',
      },
    }),
  ]);

  console.log(`Created ${children.length} children`);

  // Create activities
  const activities = await Promise.all([
    prisma.activity.create({
      data: {
        id: 'act-1',
        childId: 'child-1',
        categoryId: 'cat-1',
        institution: 'Champions Taekwondo',
        instructorName: 'Master Ahmed',
        status: 'active',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2026-12-31'),
        notes: 'Yellow belt level',
      },
    }),
    prisma.activity.create({
      data: {
        id: 'act-2',
        childId: 'child-1',
        categoryId: 'cat-1',
        institution: 'Aquatic Center',
        instructorName: 'Coach Sarah',
        status: 'active',
        startDate: new Date('2024-02-01'),
        endDate: new Date('2026-12-31'),
        notes: 'Advanced swimmers class',
      },
    }),
    prisma.activity.create({
      data: {
        id: 'act-3',
        childId: 'child-2',
        categoryId: 'cat-4',
        institution: 'Piano Academy',
        instructorName: 'Mrs. Lisa',
        status: 'active',
        startDate: new Date('2024-03-10'),
        endDate: new Date('2026-12-31'),
        notes: 'Beginner piano lessons',
      },
    }),
    prisma.activity.create({
      data: {
        id: 'act-4',
        childId: 'child-2',
        categoryId: 'cat-5',
        institution: 'Arabic Learning Center',
        instructorName: 'Mr. Hassan',
        status: 'active',
        startDate: new Date('2024-01-08'),
        endDate: new Date('2026-12-31'),
        notes: 'Classical Arabic course',
      },
    }),
  ]);

  console.log(`Created ${activities.length} activities`);

  // Create schedules
  const schedules = await Promise.all([
    prisma.schedule.create({
      data: {
        id: 'sched-1',
        activityId: 'act-1',
        dayOfWeek: 2, // Monday
        startTime: '16:00',
        endTime: '17:30',
        durationMinutes: 90,
        location: 'Champions Taekwondo Dojo',
        isActive: true,
      },
    }),
    prisma.schedule.create({
      data: {
        id: 'sched-2',
        activityId: 'act-1',
        dayOfWeek: 5, // Thursday
        startTime: '16:00',
        endTime: '17:30',
        durationMinutes: 90,
        location: 'Champions Taekwondo Dojo',
        isActive: true,
      },
    }),
    prisma.schedule.create({
      data: {
        id: 'sched-3',
        activityId: 'act-2',
        dayOfWeek: 3, // Wednesday
        startTime: '15:30',
        endTime: '16:30',
        durationMinutes: 60,
        location: 'Aquatic Center - Pool 2',
        isActive: true,
      },
    }),
    prisma.schedule.create({
      data: {
        id: 'sched-4',
        activityId: 'act-3',
        dayOfWeek: 1, // Sunday
        startTime: '10:00',
        endTime: '11:00',
        durationMinutes: 60,
        location: 'Piano Academy Studio A',
        isActive: true,
      },
    }),
  ]);

  console.log(`Created ${schedules.length} schedules`);

  // Create attendance logs
  const attendanceLogs = await Promise.all([
    prisma.attendanceLog.create({
      data: {
        id: 'log-1',
        activityId: 'act-1',
        childId: 'child-1',
        date: new Date('2026-06-16'),
        startTime: '16:05',
        durationMinutes: 85,
        status: 'present',
        instructorName: 'Master Ahmed',
        lessonNumber: 42,
        level: 'Yellow Belt',
        location: 'Champions Taekwondo Dojo',
        diaryNotes: 'Great form today, working on kicks',
      },
    }),
    prisma.attendanceLog.create({
      data: {
        id: 'log-2',
        activityId: 'act-2',
        childId: 'child-1',
        date: new Date('2026-06-18'),
        startTime: '15:35',
        durationMinutes: 55,
        status: 'present',
        instructorName: 'Coach Sarah',
        level: 'Advanced',
        location: 'Aquatic Center - Pool 2',
        diaryNotes: 'Completed 20 laps butterfly stroke',
      },
    }),
    prisma.attendanceLog.create({
      data: {
        id: 'log-3',
        activityId: 'act-3',
        childId: 'child-2',
        date: new Date('2026-06-20'),
        startTime: '10:05',
        durationMinutes: 55,
        status: 'present',
        instructorName: 'Mrs. Lisa',
        location: 'Piano Academy Studio A',
        diaryNotes: 'Learning Moonlight Sonata, good progress',
      },
    }),
  ]);

  console.log(`Created ${attendanceLogs.length} attendance logs`);

  // Create expenses
  const expenses = await Promise.all([
    prisma.expense.create({
      data: {
        id: 'exp-1',
        childId: 'child-1',
        categoryId: 'cat-1',
        activityId: 'act-1',
        institution: 'Champions Taekwondo',
        description: 'Monthly tuition',
        amount: 150,
        paymentDate: new Date('2026-06-01'),
        paidBy: 'Mother',
        year: 2026,
      },
    }),
    prisma.expense.create({
      data: {
        id: 'exp-2',
        childId: 'child-1',
        categoryId: 'cat-1',
        activityId: 'act-2',
        institution: 'Aquatic Center',
        description: 'Swimming class fees',
        amount: 120,
        paymentDate: new Date('2026-06-05'),
        paidBy: 'Father',
        year: 2026,
      },
    }),
    prisma.expense.create({
      data: {
        id: 'exp-3',
        childId: 'child-2',
        categoryId: 'cat-4',
        activityId: 'act-3',
        institution: 'Piano Academy',
        description: 'Piano lessons (4 sessions)',
        amount: 200,
        paymentDate: new Date('2026-06-10'),
        paidBy: 'Mother',
        year: 2026,
      },
    }),
  ]);

  console.log(`Created ${expenses.length} expenses`);

  // Create milestones
  const milestones = await Promise.all([
    prisma.milestone.create({
      data: {
        id: 'mile-1',
        activityId: 'act-1',
        childId: 'child-1',
        date: new Date('2026-05-20'),
        milestoneType: 'promotion',
        title: 'Yellow Belt Achievement',
        description: 'Successfully completed Yellow Belt requirements',
        result: 'Passed',
      },
    }),
    prisma.milestone.create({
      data: {
        id: 'mile-2',
        activityId: 'act-2',
        childId: 'child-1',
        date: new Date('2026-06-01'),
        milestoneType: 'achievement',
        title: '50 Laps Milestone',
        description: 'Completed 50 continuous laps without break',
        result: 'Achieved',
      },
    }),
    prisma.milestone.create({
      data: {
        id: 'mile-3',
        activityId: 'act-3',
        childId: 'child-2',
        date: new Date('2026-06-15'),
        milestoneType: 'achievement',
        title: 'First Recital',
        description: 'Performed first piano recital',
        result: 'Excellent',
      },
    }),
  ]);

  console.log(`Created ${milestones.length} milestones`);

  console.log('✅ Database seeded successfully!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
