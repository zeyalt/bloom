import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { getReflectionText, hasReflection } from "@/lib/reflection";

export const dynamic = "force-dynamic";

const MODEL = "claude-haiku-4-5-20251001";
const iso = (d: Date) => d.toISOString().slice(0, 10);

function scopeOf(activityId?: string, childId?: string) {
  if (activityId) return `activity:${activityId}`;
  if (childId) return `child:${childId}`;
  return "all";
}

function sessionMinutes(l: { durationMinutes: number | null; startTime: string | null; endTime: string | null }): number {
  if (l.durationMinutes && l.durationMinutes > 0) return l.durationMinutes;
  if (l.startTime && l.endTime) {
    const [sh, sm] = l.startTime.split(":").map(Number);
    const [eh, em] = l.endTime.split(":").map(Number);
    const d = eh * 60 + em - (sh * 60 + sm);
    return d > 0 ? d : 0;
  }
  return 0;
}

// GET ?activity_id= / ?child_id=  → cached summary or null
export async function GET(req: Request) {
  const url = new URL(req.url);
  const scope = scopeOf(url.searchParams.get("activity_id") || undefined, url.searchParams.get("child_id") || undefined);
  const row = await prisma.aiSummary.findUnique({ where: { scope } });
  return NextResponse.json(row ? { summary: row.summary, generated_at: row.generatedAt.toISOString() } : { summary: null });
}

export async function POST(req: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "AI not configured — set ANTHROPIC_API_KEY in the server environment." }, { status: 400 });
    }
    const { activity_id, child_id } = await req.json();
    const scope = scopeOf(activity_id, child_id);

    let system: string;
    let context: string;
    let heading: string;

    if (activity_id) {
      // ── Activity journey ──
      const activity = await prisma.activity.findUnique({ where: { id: activity_id }, include: { child: true, category: true } });
      if (!activity) return NextResponse.json({ error: "Activity not found" }, { status: 404 });
      const [logs, milestones] = await Promise.all([
        prisma.attendanceLog.findMany({ where: { activityId: activity_id }, orderBy: { date: "asc" } }),
        prisma.milestone.findMany({ where: { activityId: activity_id }, orderBy: { date: "asc" } }),
      ]);
      const reflections = logs.filter(l => hasReflection(l.learned, l.diaryNotes));
      if (reflections.length === 0) return NextResponse.json({ error: "Add some reflections for this activity first." }, { status: 400 });

      const attended = logs.filter(l => l.status === "attended").length;
      const absent = logs.filter(l => l.status === "absent").length;
      const rate = logs.length ? Math.round((attended / logs.length) * 100) : 0;
      const hours = (logs.filter(l => l.status !== "absent" && l.status !== "cancelled_by_provider").reduce((s, l) => s + sessionMinutes(l), 0) / 60).toFixed(1);
      const dates = logs.map(l => iso(l.date)).sort();
      const childName = activity.child?.name ?? "The child";
      const activityName = activity.activityName || activity.institution;
      heading = `${childName}'s ${activityName} journey`;
      system =
        "You are helping a parent reflect on their child's progress in one enrichment activity. Write a warm, encouraging, concise summary (~200–300 words) grounded ONLY in the notes provided — do not invent facts, skills, or events. Use the child's name naturally. Use these exact plain-text section headers on their own lines:\nOverview\nSkills & progress\nStruggles & watch-outs\nSuggested next focus\nUnder the middle two sections use short '- ' bullet lines.";
      context = [
        `Child: ${childName}`,
        `Activity: ${activityName}${activity.institution && activity.institution !== activityName ? ` (${activity.institution})` : ""}`,
        activity.category?.name ? `Category: ${activity.category.name}` : "",
        activity.level ? `Level: ${activity.level}` : "",
        activity.startDate ? `Started: ${iso(activity.startDate)}` : "",
        `Sessions: ${logs.length} (attended ${attended}, absent ${absent}, ~${rate}% attendance, ~${hours}h)`,
        dates.length ? `Date range: ${dates[0]} → ${dates[dates.length - 1]}` : "",
        milestones.length ? `Milestones:\n${milestones.map(m => `- ${iso(m.date)}: ${m.title}${m.result ? ` — ${m.result}` : ""}`).join("\n")}` : "",
        "",
        "Chronological reflections (date — note):",
        ...reflections.map(l => `- ${iso(l.date)} — ${getReflectionText(l.learned, l.diaryNotes)}`),
      ].filter(Boolean).join("\n");
    } else {
      // ── Overview + highlights (child or all) ──
      const where: { childId?: string; OR: object[] } = { OR: [{ learned: { not: null } }, { diaryNotes: { not: null } }] };
      if (child_id) where.childId = child_id;
      const logs = await prisma.attendanceLog.findMany({
        where,
        include: { activity: true, child: true },
        orderBy: { date: "desc" },
        take: 40,
      });
      if (logs.length === 0) return NextResponse.json({ error: "Add some reflections first." }, { status: 400 });
      const chrono = [...logs].reverse();
      const multiChild = !child_id;
      const who = child_id ? (logs[0].child?.name ?? "This child") : "the children";
      heading = child_id ? `${logs[0].child?.name ?? "Child"}'s learning overview` : "Learning overview";
      system =
        `You are helping a parent see what ${who} have been learning across activities. Write a warm, concise summary grounded ONLY in the notes provided — do not invent anything. Use these exact plain-text section headers on their own lines:\nOverview\nKey highlights\n` +
        `Under 'Overview' write 2–4 sentences on recent learning themes and progress${multiChild ? " (mention each child)" : ""}. Under 'Key highlights' give 4–8 '- ' bullets of genuine standout moments — each naming the activity${multiChild ? " and child" : ""} and roughly when.`;
      context = [
        "Recent reflections (date · " + (multiChild ? "child · " : "") + "activity — note):",
        ...chrono.map(l => {
          const act = l.activity?.activityName || l.activity?.institution || "Activity";
          return `- ${iso(l.date)} · ${multiChild ? `${l.child?.name ?? "?"} · ` : ""}${act} — ${getReflectionText(l.learned, l.diaryNotes)}`;
        }),
      ].join("\n");
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 700,
      system,
      messages: [{ role: "user", content: `${context}\n\nWrite the summary for: ${heading}.` }],
    });
    const summary = message.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map(b => b.text).join("\n").trim();

    const now = new Date();
    await prisma.aiSummary.upsert({
      where: { scope },
      create: { scope, summary, generatedAt: now },
      update: { summary, generatedAt: now },
    });

    return NextResponse.json({ summary, generated_at: now.toISOString() });
  } catch (err) {
    console.error("AI summary failed:", err);
    return NextResponse.json({ error: "Failed to generate summary" }, { status: 500 });
  }
}
