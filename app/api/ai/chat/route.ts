import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { parseChartSpec, type ChartSpec } from "@/lib/chat-chart";

export const dynamic = "force-dynamic";
// An answer can take several query round-trips with the model.
export const maxDuration = 60;

const MODEL = "claude-sonnet-5-5";
const MAX_TOOL_ROUNDS = 8;
const MAX_ROWS = 200;
const MAX_HISTORY = 20;
const MAX_MESSAGE_CHARS = 4000;

type ChatMessage = { role: "user" | "assistant"; content: string };

const SCHEMA = `PostgreSQL tables (all ids are text; DATE columns have no time part):

children(id, name, nickname, date_of_birth DATE, school, color_code)
activity_categories(id, name)  -- e.g. Sports, Tuition, Hobby, Religious Class, Music
activities(id, child_id, category_id, activity_name, institution, instructor_name, level,
  status, start_date DATE, end_date DATE, notes)
  -- One row per enrolment stint; a child who restarted an activity has several rows with
  -- the same activity_name. Display name = COALESCE(activity_name, institution).
  -- status: active | completed | dropped. status is authoritative for "still going";
  -- end_date may be a planned term end that is still in the future.
schedules(id, activity_id, day_of_week INT 0=Sun..6=Sat, start_time 'HH:MM', end_time 'HH:MM',
  duration_minutes, location, term, is_active, effective_from DATE, effective_until DATE)
  -- is_active stays true on past terms. The CURRENT timetable is rows where
  -- (effective_from IS NULL OR effective_from <= CURRENT_DATE) AND
  -- (effective_until IS NULL OR effective_until >= CURRENT_DATE).
attendance_logs(id, activity_id, child_id, date DATE, start_time, end_time, duration_minutes,
  status, sent_by, fetcher, instructor_name, lesson_type, location, absence_reason,
  lesson_number, level, learned, diary_notes, remarks)
  -- status: attended | absent | cancelled_by_provider | replacement | trial.
  -- A session "happened" unless status is absent or cancelled_by_provider.
  -- Minutes = duration_minutes if > 0, else end_time - start_time.
  -- sent_by / fetcher may hold several names, comma-separated ("Zeya, Atiqah"):
  -- credit each person; e.g. unnest(string_to_array(sent_by, ',')) then trim().
  -- learned / diary_notes are the parent's reflection notes on the session.
expenses(id, child_id, category_id, activity_id NULLABLE, institution, description,
  amount FLOAT (SGD), payment_date DATE, paid_by, year INT, num_lessons, expense_type, receipt_notes)
  -- expense_type: Lesson | Registration | Grading | Competition | Miscellaneous.
  -- paid_by can be a joint payer, e.g. 'Zeya & Atiqah'.
  -- Cost per lesson = amount / num_lessons on a Lesson-type payment. An activity's current
  -- price comes from its latest Lesson payment.
milestones(id, activity_id, child_id, date DATE, milestone_type, title, description, result)
senders(id, name, relationship)  -- people who drop off / pick up the children`;

function systemPrompt() {
  const today = new Date().toISOString().slice(0, 10);
  return `You answer a parent's questions about their children's enrichment activities using the family's own records in the Bloom app. Today is ${today}.

Tools:
- run_sql runs a single read-only PostgreSQL SELECT against the data below. Always ground answers in query results — never guess numbers. Do the arithmetic in SQL (COUNT, SUM, AVG, GROUP BY) rather than in your head. If you are unsure of a name or value, look it up first (e.g. SELECT DISTINCT). Join to children and activities to report names, never ids.
- show_chart attaches a visual to your answer, drawn below your text. Use it whenever the answer is numbers:
  - stats: 1–4 headline figures (a total, a count, an average) — e.g. "Spent this year", "Sessions attended".
  - bar: comparing a few things (activities, people, months) — prefer this to a bulleted list of numbers.
  - donut: shares of a whole (spend by category, who paid) — up to ~6 slices.
  - line: a trend over time (monthly spend, hours per month), one series per child if comparing.
  Set child to the child's name on items/series that belong to one child, so they get that child's colour.
  Usually one chart is right; use two only when they show genuinely different things. Skip charts for yes/no, a single fact, a schedule, or reflections.

${SCHEMA}

How to write the answer:
- Lead with the answer in one or two sentences. If a chart carries the numbers, don't repeat them all in prose — just call out what matters.
- Markdown is rendered: **bold** for the key figure or name, "- " bullet lists for short lists. No tables (use a chart), no headings, no links.
- Money is in SGD; write it like $1,234.50. Write dates like 12 Oct 2026.
- If the question is ambiguous (which child, which period), make a sensible assumption and say what you assumed.
- If the records can't answer the question, say so plainly and say what is missing.
- Only answer questions about this family's activities, schedules, attendance, spending and reflections.`;
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: "run_sql",
    description:
      "Run one read-only PostgreSQL SELECT (or WITH … SELECT) query against the family's Bloom database and get the rows back as JSON. At most 200 rows are returned; aggregate in SQL when you need totals.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "A single SELECT statement. No semicolon-separated statements." },
      },
      required: ["query"],
    },
  },
  {
    name: "show_chart",
    description:
      "Attach a chart to your answer (drawn below your text, in order). Use for numeric answers. Values must come from run_sql results.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["stats", "bar", "donut", "line"] },
        title: { type: "string", description: "Short title, e.g. 'Spending by activity, 2026'. Required except for stats." },
        format: { type: "string", enum: ["currency", "hours", "number", "percent"], description: "How to display values." },
        stats: {
          type: "array",
          description: "For type=stats: 1–4 headline figures.",
          items: {
            type: "object",
            properties: { label: { type: "string" }, value: { type: "number" }, note: { type: "string", description: "Optional short context, e.g. 'vs $14,200 in 2025'" } },
            required: ["label", "value"],
          },
        },
        items: {
          type: "array",
          description: "For type=bar or donut. Order bars as you want them shown (usually largest first).",
          items: {
            type: "object",
            properties: { label: { type: "string" }, value: { type: "number" }, child: { type: "string", description: "Child's name, if this item belongs to one child" } },
            required: ["label", "value"],
          },
        },
        x: { type: "array", items: { type: "string" }, description: "For type=line: x-axis labels, e.g. ['Jan 26', 'Feb 26']." },
        series: {
          type: "array",
          description: "For type=line: one entry per line; values align with x.",
          items: {
            type: "object",
            properties: { name: { type: "string" }, values: { type: "array", items: { type: "number" } }, child: { type: "string" } },
            required: ["name", "values"],
          },
        },
      },
      required: ["type", "format"],
    },
  },
];

// Postgres returns COUNT/SUM as BigInt and dates as Date objects; neither is JSON-safe as-is.
function toJsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toJsonSafe(v)]));
  }
  return value;
}

async function runSql(query: string): Promise<{ content: string; isError: boolean }> {
  const sql = query.trim().replace(/;\s*$/, "");
  if (!/^(select|with)\b/i.test(sql)) {
    return { content: "Only a single SELECT (or WITH … SELECT) query is allowed.", isError: true };
  }
  try {
    // The transaction is read-only, so Postgres itself rejects any write, and the
    // prepared-statement protocol rejects a second statement smuggled after the first.
    const rows = await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '5s'");
      return tx.$queryRawUnsafe<Record<string, unknown>[]>(sql);
    });
    const safe = toJsonSafe(rows) as unknown[];
    const shown = safe.slice(0, MAX_ROWS);
    const note = safe.length > MAX_ROWS ? ` (showing first ${MAX_ROWS} of ${safe.length} rows — aggregate instead)` : "";
    return { content: `${safe.length} row(s)${note}:\n${JSON.stringify(shown)}`, isError: false };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const pgError = msg.match(/Message: `([^`]+)`/)?.[1] ?? msg.slice(0, 300);
    return { content: `Query failed: ${pgError}`, isError: true };
  }
}

function parseMessages(body: unknown): ChatMessage[] | null {
  const messages = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(messages) || messages.length === 0) return null;
  const valid = messages.every(
    m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim().length > 0,
  );
  if (!valid || messages[messages.length - 1].role !== "user") return null;
  return messages.slice(-MAX_HISTORY).map(m => ({ role: m.role, content: String(m.content).slice(0, MAX_MESSAGE_CHARS) }));
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured — set ANTHROPIC_API_KEY in the server environment." }, { status: 400 });
  }
  const history = parseMessages(await req.json().catch(() => null));
  if (!history) return NextResponse.json({ error: "Send a question to ask." }, { status: 400 });
  // History is trimmed from the front; the API needs it to start with a user turn.
  while (history.length && history[0].role !== "user") history.shift();

  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = history.map(m => ({ role: m.role, content: m.content }));
  const system: Anthropic.TextBlockParam[] = [{ type: "text", text: systemPrompt(), cache_control: { type: "ephemeral" } }];

  const charts: ChartSpec[] = [];
  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system,
        tools: TOOLS,
        // Last round: force a written answer from what it has already looked up.
        ...(round === MAX_TOOL_ROUNDS ? { tool_choice: { type: "none" as const } } : {}),
        messages,
      });

      const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
        const answer = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map(b => b.text)
          .join("\n")
          .trim();
        return NextResponse.json({ answer: answer || "I couldn't find an answer to that.", charts });
      }

      messages.push({ role: "assistant", content: response.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const use of toolUses) {
        if (use.name === "show_chart") {
          const spec = parseChartSpec(use.input);
          if (typeof spec === "string") {
            results.push({ type: "tool_result", tool_use_id: use.id, content: `Chart rejected: ${spec}`, is_error: true });
          } else {
            charts.push(spec);
            results.push({ type: "tool_result", tool_use_id: use.id, content: "Chart added below your answer." });
          }
          continue;
        }
        const query = (use.input as { query?: unknown })?.query;
        const { content, isError } =
          typeof query === "string" ? await runSql(query) : { content: "Missing 'query'.", isError: true };
        results.push({ type: "tool_result", tool_use_id: use.id, content, is_error: isError });
      }
      messages.push({ role: "user", content: results });
    }
    return NextResponse.json({ answer: "That question needed more lookups than I can do in one go. Try asking something narrower.", charts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: `Chat failed: ${msg}` }, { status: 500 });
  }
}
