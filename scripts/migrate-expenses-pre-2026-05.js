import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const CUTOFF = "2026-05-01";
const csvPath =
  process.argv.find(a => a.endsWith(".csv")) ||
  "/Users/zeyalt/.cursor/projects/Users-zeyalt-MySpace-Personal-Data-Science-Projects/attachments/655d5f85-868a-428b-adf1-706f76c292e5/Enrichment_Tracker_-_Expenses.csv";

const CATEGORY_MAP = {
  "religious class": "Religious Class",
  taekwondo: "Sports",
  football: "Sports",
  swimming: "Sports",
  "academic tuition": "Tuition",
  "other hobbies": "Hobby",
  speedcubing: "Hobby",
  "k-pop dance": "Hobby",
  abacus: "Hobby",
  "english speech & drama": "Hobby",
};

const PAYER_MAP = {
  zeya: "Zeya",
  atiqah: "Atiqah",
  "both (ocbc)": "Zeya & Atiqah",
  "zara's cda": "Zara",
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");
  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      cell += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ",") { row.push(cell); cell = ""; i++; continue; }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = ""; i++; continue;
    }
    cell += ch; i++;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}

function parseAmount(raw) {
  const n = Number(String(raw).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function isoDay(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(date, n) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

function parseNumLessons(description) {
  const range = description.match(/Lesson(?:s)?\s+(\d+)\s*[-–]\s*(\d+)/i);
  if (range) return Number(range[2]) - Number(range[1]) + 1;
  const n = description.match(/(\d+)\s+(?:Classes|Lessons|trainings)\b/i);
  return n ? Number(n[1]) : null;
}

function parseTermDates(description) {
  const months = "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec";
  const re = new RegExp(
    `(\\d{1,2}\\s+(?:${months})[a-z]*\\s+20\\d{2})\\s+to\\s+(\\d{1,2}\\s+(?:${months})[a-z]*\\s+20\\d{2})`,
    "i"
  );
  const m = description.match(re);
  if (!m) return { start: null, end: null };
  const start = new Date(m[1] + " UTC");
  const end = new Date(m[2] + " UTC");
  if (Number.isNaN(+start) || Number.isNaN(+end)) return { start: null, end: null };
  return { start, end };
}

function yearFromDescription(description) {
  const ay = description.match(/AY\s*(20\d{2})/i);
  if (ay) return Number(ay[1]);
  const term = description.match(/\b(20\d{2})\s+Term\b/i);
  if (term) return Number(term[1]);
  const monthYear = description.match(
    /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(20\d{2})/i
  );
  if (monthYear) return Number(monthYear[1]);
  const fees = description.match(/\b(20\d{2})\s+fees\b/i);
  if (fees) return Number(fees[1]);
  return null;
}

function splitAlive(institution) {
  const m = institution.match(/^ALIVE\s*\((.+)\)$/i);
  if (m) return { activityName: "aLIVE Madrasah", institution: m[1].trim() };
  const aqsa = institution.match(/^AQSA\s*\((.+)\)$/i);
  if (aqsa) return { activityName: "AQSA", institution: aqsa[1].trim() };
  return null;
}

function normalizeTarget(csvCat, csvInst) {
  const inst = csvInst.trim();
  const cat = csvCat.trim();
  const alive = splitAlive(inst);
  if (alive) return alive;

  const lower = inst.toLowerCase();
  if (/jeong[-\s]?in taekwondo/.test(lower)) {
    return { activityName: "Taekwondo", institution: "Jeong-in Taekwondo" };
  }
  if (lower === "barca academy" || lower === "barça academy") {
    return { activityName: "Soccer", institution: "Barca Academy" };
  }
  if (lower === "onepa" && /football/i.test(cat)) {
    return { activityName: "Soccer", institution: "OnePA" };
  }
  if (lower === "berries") return { activityName: "Chinese Tuition", institution: "Berries" };
  if (lower === "the learning lab") return { activityName: "English Tuition", institution: "The Learning Lab" };
  if (/coach kang/i.test(inst)) return { activityName: "Swimming", institution: "Coach Kang" };
  if (/coach reuben/i.test(inst)) return { activityName: "Swimming", institution: "Coach Reuben" };
  if (/coach daryl/i.test(inst)) return { activityName: "Speedcubing", institution: "Coach Daryl" };
  if (/coach arun/i.test(inst)) return { activityName: "Speedcubing", institution: "Coach Arun" };
  if (/mofunland/i.test(inst)) return { activityName: "Speedcubing", institution: "Mofunland" };
  if (/cubewerkz/i.test(inst)) return { activityName: "Speedcubing", institution: "Cubewerkz" };
  if (lower === "others" && /speedcubing/i.test(cat)) {
    return { activityName: "Speedcubing", institution: "Others" };
  }
  if (/nk robotics/i.test(inst)) return { activityName: "Robotics", institution: "NK Robotics" };
  if (/mixed media art/i.test(inst)) return { activityName: "Mixed Media Art", institution: "Mixed Media Art" };
  if (/s4k|skool4kidz/i.test(inst)) return { activityName: "K-Pop Dance", institution: "Skool4Kidz" };
  if (/crestar/i.test(inst)) {
    if (/abacus/i.test(cat)) return { activityName: "Abacus", institution: "Crestar" };
    if (/speech/i.test(cat)) return { activityName: "English Speech & Drama", institution: "Crestar" };
    if (/k-pop/i.test(cat)) return { activityName: "K-Pop Dance", institution: "Crestar" };
    return { activityName: cat, institution: "Crestar" };
  }
  return { activityName: cat, institution: inst };
}

function descriptionsOverlap(a, b) {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  if (!x || !y) return true;
  if (x === y) return true;
  return x.includes(y) || y.includes(x);
}

async function main() {
  const raw = readFileSync(csvPath, "utf8");
  const table = parseCsv(raw);
  const header = table[0].map(h => h.trim());
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  const col = (row, name) => (row[idx[name]] ?? "").trim();

  const children = await prisma.child.findMany();
  const categories = await prisma.activityCategory.findMany();
  const activities = await prisma.activity.findMany();
  const existing = await prisma.expense.findMany();

  const childByName = Object.fromEntries(children.map(c => [c.name.toLowerCase(), c]));
  const catByName = Object.fromEntries(categories.map(c => [c.name.toLowerCase(), c]));

  const stats = { inserted: 0, skippedEmpty: 0, skippedCutoff: 0, skippedDup: 0, createdActivities: 0 };
  const createdKeys = new Map();
  const planned = [];

  function activityKey(childId, activityName, institution) {
    return `${childId}|${activityName.toLowerCase()}|${institution.toLowerCase()}`;
  }

  function pickExistingActivity(childId, target, paymentDate, description) {
    const pool = activities.filter(a =>
      a.childId === childId &&
      a.institution.toLowerCase() === target.institution.toLowerCase() &&
      (a.activityName || "").toLowerCase() === target.activityName.toLowerCase()
    );
    if (pool.length === 0) return null;
    if (pool.length === 1) return pool[0];

    const descYear = yearFromDescription(description);
    if (descYear) {
      const byYear = pool.filter(a => {
        const startY = a.startDate ? a.startDate.getUTCFullYear() : null;
        const endY = a.endDate ? a.endDate.getUTCFullYear() : startY;
        if (startY == null) return false;
        return descYear >= startY && descYear <= (endY ?? startY);
      });
      if (byYear.length === 1) return byYear[0];
      if (byYear.length > 1) {
        return byYear.sort((a, b) => Math.abs((a.startDate?+a.startDate:0) - +paymentDate) - Math.abs((b.startDate?+b.startDate:0) - +paymentDate))[0];
      }
    }

    const windowed = pool
      .map(a => {
        const start = a.startDate ? addDays(a.startDate, -120) : new Date("1970-01-01");
        const end = a.endDate ? addDays(a.endDate, 60) : new Date("2100-01-01");
        const inRange = paymentDate >= start && paymentDate <= end;
        return { a, inRange };
      })
      .filter(x => x.inRange)
      .map(x => x.a);
    if (windowed.length === 1) return windowed[0];
    if (windowed.length > 1) {
      return windowed.sort((a, b) => Math.abs((a.startDate?+a.startDate:0) - +paymentDate) - Math.abs((b.startDate?+b.startDate:0) - +paymentDate))[0];
    }
    return pool.sort((a, b) => Math.abs((a.startDate?+a.startDate:0) - +paymentDate) - Math.abs((b.startDate?+b.startDate:0) - +paymentDate))[0];
  }

  async function ensureActivity(childId, categoryId, target, paymentDate, description) {
    const existingMatch = pickExistingActivity(childId, target, paymentDate, description);
    if (existingMatch) return { activity: existingMatch, created: false };

    const key = activityKey(childId, target.activityName, target.institution);
    if (createdKeys.has(key)) return { activity: createdKeys.get(key), created: false };

    const data = {
      childId,
      categoryId,
      activityName: target.activityName,
      institution: target.institution,
      status: "completed",
    };
    if (!APPLY) {
      const fake = { id: `pending:${key}`, ...data };
      createdKeys.set(key, fake);
      return { activity: fake, created: true };
    }
    const activity = await prisma.activity.create({ data });
    activities.push(activity);
    createdKeys.set(key, activity);
    return { activity, created: true };
  }

  for (const row of table.slice(1)) {
    const name = col(row, "Name");
    const csvCat = col(row, "Activity Category");
    const csvInst = col(row, "Enrichment Institution");
    const description = col(row, "Description");
    const amount = parseAmount(col(row, "Amount"));
    const payment = col(row, "Payment Date");
    const csvPayer = col(row, "Payment By");
    const year = Number(col(row, "Year"));

    if (!name || !payment || amount == null) { stats.skippedEmpty++; continue; }
    if (payment >= CUTOFF) { stats.skippedCutoff++; continue; }

    const child = childByName[name.toLowerCase()];
    if (!child) throw new Error(`Unknown child: ${name}`);

    const mappedCat = CATEGORY_MAP[csvCat.trim().toLowerCase()];
    if (!mappedCat) throw new Error(`Unmapped category: ${csvCat}`);
    const category = catByName[mappedCat.toLowerCase()];
    if (!category) throw new Error(`Missing DB category: ${mappedCat}`);

    const paidBy = PAYER_MAP[csvPayer.toLowerCase()];
    if (!paidBy) throw new Error(`Unmapped payer: ${csvPayer}`);

    const target = normalizeTarget(csvCat, csvInst);
    const paymentDate = new Date(payment + "T00:00:00.000Z");

    const { activity, created } = await ensureActivity(child.id, category.id, target, paymentDate, description);
    if (created) stats.createdActivities++;

    const dup = existing.some(e =>
      e.childId === child.id &&
      isoDay(e.paymentDate) === payment &&
      e.amount === amount &&
      e.institution.toLowerCase() === target.institution.toLowerCase() &&
      (e.activityId ? e.activityId === activity.id : true) &&
      descriptionsOverlap(e.description || "", description)
    );
    if (dup) { stats.skippedDup++; continue; }

    const terms = parseTermDates(description);
    const payload = {
      childId: child.id,
      categoryId: category.id,
      activityId: activity.id.startsWith("pending:") ? null : activity.id,
      institution: target.institution,
      description,
      amount,
      paymentDate,
      paidBy,
      year: Number.isFinite(year) ? year : paymentDate.getUTCFullYear(),
      termStartDate: terms.start,
      termEndDate: terms.end,
      numLessons: parseNumLessons(description),
    };

    planned.push({
      child: child.name,
      date: payment,
      amount,
      paidBy,
      category: mappedCat,
      activity: `${target.activityName} / ${target.institution}`,
      linked: activity.id.startsWith("pending:") ? "new" : "existing",
      description,
    });

    if (APPLY) {
      const createdExp = await prisma.expense.create({ data: payload });
      existing.push(createdExp);
    }
    stats.inserted++;
  }

  console.log(APPLY ? "APPLY" : "DRY RUN (pass --apply to write)");
  console.log(`CSV: ${csvPath}`);
  console.log(stats);
  const byLinked = planned.reduce((acc, p) => { acc[p.linked] = (acc[p.linked] || 0) + 1; return acc; }, {});
  console.log("link:", byLinked);
  const newActs = [...createdKeys.values()].filter(a => String(a.id).startsWith("pending:") || stats.createdActivities);
  const uniqueNew = [...createdKeys.entries()].map(([key, a]) => {
    const [, name, inst] = key.split("|");
    const child = children.find(c => key.startsWith(c.id));
    return `${child?.name} — ${a.activityName} / ${a.institution}`;
  });
  console.log("stub activities:");
  uniqueNew.forEach(l => console.log("  " + l));
  console.log("\nfirst 8 / last 4 rows:");
  [...planned.slice(0, 8), ...planned.slice(-4)].forEach(p => {
    console.log(`  ${p.date} ${p.child} $${p.amount} [${p.paidBy}] ${p.activity} (${p.linked}) — ${p.description.slice(0, 60)}`);
  });

  await prisma.$disconnect();
}

main().catch(async err => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
