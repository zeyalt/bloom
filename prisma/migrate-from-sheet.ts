import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'crypto';

const prisma = new PrismaClient();

// Helper to parse Date(year, month, day) format from Google Sheets
function parseGoogleSheetDate(dateStr: string): Date {
  if (!dateStr || dateStr === 'Date(1899,11,30)') return new Date(); // Invalid date
  const match = dateStr.match(/Date\((\d+),(\d+),(\d+)\)/);
  if (!match) return new Date(dateStr);
  const [, year, month, day] = match;
  return new Date(parseInt(year), parseInt(month), parseInt(day));
}

// Color codes for emoji mapping
const categoryColors: Record<string, string> = {
  'Religious Class': '#E74C3C',
  'Taekwondo': '#3498DB',
  'Other Hobbies': '#F39C12',
  'Academic Tuition': '#9B59B6',
  'Football': '#27AE60',
  'Speedcubing': '#1ABC9C',
  'Swimming': '#3498DB',
  'K-Pop Dance': '#E91E63',
  'English Speech & Drama': '#FF6B6B',
  'Abacus': '#FFC107',
};

const categoryEmojis: Record<string, string> = {
  'Religious Class': '🕌',
  'Taekwondo': '🥋',
  'Other Hobbies': '🎯',
  'Academic Tuition': '📚',
  'Football': '⚽',
  'Speedcubing': '🎲',
  'Swimming': '🏊',
  'K-Pop Dance': '💃',
  'English Speech & Drama': '🎭',
  'Abacus': '🧮',
};

interface ExpenseData {
  Name: string;
  'Activity Category': string;
  'Enrichment Institution': string;
  Description: string;
  'Amount ': number;
  'Payment Date': string;
  'Payment By': string;
  Year: number;
}

async function migrateExpenses(expenseData: ExpenseData[]) {
  console.log('Starting expense migration...');

  // Step 1: Create/get children
  const childrenMap: Record<string, string> = {};
  const uniqueChildren = [...new Set(expenseData.map(e => e.Name).filter(Boolean))];

  for (const childName of uniqueChildren) {
    let child = await prisma.child.findFirst({ where: { name: childName } });
    if (!child) {
      child = await prisma.child.create({
        data: {
          id: uuidv4(),
          name: childName,
          colorCode: childName === 'Zayyan' ? '#D4895C' : '#2E7D32',
          avatarEmoji: childName === 'Zayyan' ? '👦' : '👧',
        },
      });
      console.log(`✓ Created child: ${childName}`);
    }
    childrenMap[childName] = child.id;
  }

  // Step 2: Create/get categories
  const categoryMap: Record<string, string> = {};
  const uniqueCategories = [...new Set(expenseData.map(e => e['Activity Category']).filter(Boolean))];

  for (const categoryName of uniqueCategories) {
    let category = await prisma.activityCategory.findFirst({ where: { name: categoryName } });
    if (!category) {
      category = await prisma.activityCategory.create({
        data: {
          id: uuidv4(),
          name: categoryName,
          colorCode: categoryColors[categoryName] || '#95A5A6',
          icon: categoryEmojis[categoryName] || '📌',
        },
      });
      console.log(`✓ Created category: ${categoryName}`);
    }
    categoryMap[categoryName] = category.id;
  }

  // Step 3: Create placeholder activities (link child to category via institution)
  const activityMap: Record<string, string> = {};
  const uniqueActivities = [...new Set(expenseData.map(e => e['Enrichment Institution']).filter(Boolean))];

  for (const institution of uniqueActivities) {
    const expenseItem = expenseData.find(e => e['Enrichment Institution'] === institution);
    if (expenseItem && expenseItem.Name) {
      const activityKey = `${expenseItem.Name}-${institution}`;
      let activity = await prisma.activity.findFirst({
        where: { institution },
      });

      if (!activity) {
        activity = await prisma.activity.create({
          data: {
            id: uuidv4(),
            childId: childrenMap[expenseItem.Name],
            categoryId: categoryMap[expenseItem['Activity Category']],
            institution,
            status: 'active',
            startDate: new Date('2022-01-01'),
            endDate: new Date('2026-12-31'),
          },
        });
        console.log(`✓ Created activity: ${institution}`);
      }
      activityMap[activityKey] = activity.id;
    }
  }

  // Step 4: Insert expenses
  let expenseCount = 0;
  for (const exp of expenseData) {
    if (!exp.Name || !exp['Activity Category']) continue;

    const activityKey = `${exp.Name}-${exp['Enrichment Institution']}`;
    const activity = await prisma.activity.findFirst({
      where: { institution: exp['Enrichment Institution'], child: { name: exp.Name } },
    });

    if (!activity) continue;

    try {
      await prisma.expense.create({
        data: {
          id: uuidv4(),
          childId: childrenMap[exp.Name],
          categoryId: categoryMap[exp['Activity Category']],
          activityId: activity.id,
          institution: exp['Enrichment Institution'],
          description: exp.Description || 'N/A',
          amount: exp['Amount '] || 0,
          paymentDate: parseGoogleSheetDate(exp['Payment Date']),
          paidBy: exp['Payment By'] || 'Unknown',
          year: exp.Year || new Date().getFullYear(),
        },
      });
      expenseCount++;
    } catch (err) {
      console.error(`Failed to create expense for ${exp.Name}: ${err}`);
    }
  }

  console.log(`✓ Created ${expenseCount} expenses`);
}

async function main() {
  try {
    // Import your expense data here
    const expenseData: ExpenseData[] = [
      // PASTE YOUR EXPENSE DATA HERE
    ];

    await migrateExpenses(expenseData);
    console.log('✅ Migration completed!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
