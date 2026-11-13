// One-off, for merging My Day: copies what was set up on the Neon `my-day` copy into
// production. Run AFTER `prisma migrate deploy` on production.
//
//   node scripts/copy-my-day-setup.js           # dry run: shows what it would do
//   node scripts/copy-my-day-setup.js --apply   # does it, in one transaction
//
// Reads the copy's URL from .env.local and production's from .env.local.production-backup.
// - New My Day tables (calendars, school hours, routines, ticks, day lists, one-off tasks):
//   every row is copied (production has none yet).
// - children, activities, goals: rows edited on the copy since it was made (and not edited
//   on production) get the copy's values: school details, class prep, homework, daily practice.
// - attendance_logs: logs that exist only on the copy are added.
// Nothing on production is deleted; rows that exist only on production are left alone.
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");

const urlFrom = file => {
  const line = fs.readFileSync(file, "utf8").split("\n").find(l => l.startsWith("DATABASE_URL="));
  return line.replace(/^DATABASE_URL=/, "").replace(/^"|"$/g, "");
};
const COPY = urlFrom(".env.local");
const PROD = urlFrom(".env.local.production-backup");
if (!COPY.includes("ep-shiny-waterfall")) throw new Error(".env.local is not the my-day copy");
if (PROD.includes("ep-shiny-waterfall")) throw new Error(".env.local.production-backup points at the copy");

const apply = process.argv.includes("--apply");
const copy = new PrismaClient({ datasourceUrl: COPY });
const prod = new PrismaClient({ datasourceUrl: PROD });

// In foreign-key order: calendars before the children that point at them, etc.
const NEW_TABLES = ["school_calendars", "calendar_days", "school_hours", "routine_items", "task_ticks", "day_plans", "one_off_tasks"];
const EDITED_TABLES = ["children", "activities", "goals"];

const rowsOf = async (db, table, where = "true") =>
  (await db.$queryRawUnsafe(`select row_to_json(x)::text j from "${table}" x where ${where}`)).map(r => JSON.parse(r.j));
const columnsOf = async table =>
  (await prod.$queryRawUnsafe(`select column_name from information_schema.columns where table_schema='public' and table_name=$1`, table))
    .map(r => r.column_name);

async function main() {
  const migrated = await prod.$queryRawUnsafe(`select 1 from information_schema.tables where table_name='one_off_tasks'`);
  if (!migrated.length) throw new Error("Production isn't migrated yet: run `prisma migrate deploy` against it first.");

  const plan = []; // [description, sql, json]

  for (const t of NEW_TABLES) {
    const rows = await rowsOf(copy, t);
    const have = new Set((await prod.$queryRawUnsafe(`select id from "${t}"`)).map(r => r.id));
    const add = rows.filter(r => !have.has(r.id));
    if (add.length) plan.push([`${t}: add ${add.length}`,
      `insert into "${t}" select * from json_populate_recordset(null::"${t}", $1::json) on conflict (id) do nothing`, add]);
  }

  for (const t of EDITED_TABLES) {
    const prodRows = new Map((await rowsOf(prod, t)).map(r => [r.id, r]));
    const edited = (await rowsOf(copy, t)).filter(r => {
      const p = prodRows.get(r.id);
      return p && new Date(r.updated_at) > new Date(p.updated_at);
    });
    if (!edited.length) continue;
    const cols = (await columnsOf(t)).filter(c => c !== "id");
    const set = cols.map(c => `"${c}" = s."${c}"`).join(", ");
    plan.push([`${t}: update ${edited.length} (${edited.map(r => r.name ?? r.activity_name ?? r.title).join(", ")})`,
      `update "${t}" d set ${set} from json_populate_recordset(null::"${t}", $1::json) s where d.id = s.id`, edited]);
  }

  const prodLogs = new Set((await prod.$queryRawUnsafe(`select id from attendance_logs`)).map(r => r.id));
  const newLogs = (await rowsOf(copy, "attendance_logs")).filter(r => !prodLogs.has(r.id));
  if (newLogs.length) plan.push([`attendance_logs: add ${newLogs.length} (${newLogs.map(l => `${l.date.slice(0, 10)} ${l.status}`).join(", ")})`,
    `insert into attendance_logs select * from json_populate_recordset(null::attendance_logs, $1::json) on conflict (id) do nothing`, newLogs]);

  console.log(plan.length ? plan.map(p => "- " + p[0]).join("\n") : "Nothing to copy.");
  if (!apply) { console.log("\nDry run. Add --apply to do it."); return; }

  await prod.$transaction(plan.map(([, sql, rows]) => prod.$executeRawUnsafe(sql, JSON.stringify(rows))));
  console.log("\nDone.");
}

main()
  .catch(e => { console.error(e.message); process.exitCode = 1; })
  .finally(async () => { await copy.$disconnect(); await prod.$disconnect(); });
