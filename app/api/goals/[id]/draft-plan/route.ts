import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { badRequest, parseDay } from "@/lib/goal-queries";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "claude-opus-5-5";
const MAX_CHECKPOINTS = 8;
const MAX_CONTEXT_CHARS = 2000;

const SYSTEM = `You help a parent turn a goal for their child into a short, realistic action plan: a few dated checkpoints between today and the target date.

Rules for the checkpoints:
- Each one is a concrete, observable state the parent can tick off ("Sleeps alone 3 nights a week", "Glides 10 m with feet up"), not an activity to do or advice.
- They build progressively toward the goal; the last one falls exactly on the target date and is the goal itself, met.
- Space them roughly evenly: about monthly, or about every two weeks when the runway is under four months. Use 3 to ${MAX_CHECKPOINTS} checkpoints.
- Pitch them to the child's age and to what the parent says the child can already do. Never repeat a checkpoint already hit; continue from there.
- Plain words, one short line each (under 90 characters). No emoji, no medical or diagnostic claims.
- Dates are YYYY-MM-DD, strictly after today and no later than the target date, in ascending order.`;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    checkpoints: {
      type: "array",
      items: {
        type: "object",
        properties: {
          due_date: { type: "string", description: "YYYY-MM-DD" },
          text: { type: "string" },
        },
        required: ["due_date", "text"],
        additionalProperties: false,
      },
    },
  },
  required: ["checkpoints"],
  additionalProperties: false,
} as const;

function ageLabel(dob: Date | null, today: Date): string {
  if (!dob) return "unknown";
  let months = (today.getUTCFullYear() - dob.getUTCFullYear()) * 12 + (today.getUTCMonth() - dob.getUTCMonth());
  if (today.getUTCDate() < dob.getUTCDate()) months--;
  const y = Math.floor(months / 12), m = months % 12;
  return `${y} years${m ? ` ${m} months` : ""}`;
}

const day = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Draft (not save) a milestone goal's action plan.
 * Body: { context?: string, today?: "YYYY-MM-DD" (the parent's local date) }
 * → { checkpoints: [{ due_date, text }] }
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const context = typeof body.context === "string" ? body.context.trim().slice(0, MAX_CONTEXT_CHARS) : "";
    const today = parseDay(body.today) ?? parseDay(day(new Date()))!;

    const goal = await prisma.goal.findUnique({
      where: { id },
      include: { child: true, checkpoints: { orderBy: { dueDate: "asc" } }, entries: { orderBy: { date: "desc" }, take: 10 } },
    });
    if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    if (goal.kind !== "milestone") return badRequest("Only milestone goals have action plans");
    if (goal.targetDate <= today) return badRequest("The target date has passed — move it later to draft a plan");

    const hit = goal.checkpoints.filter(c => c.hitDate);
    const notes = goal.entries.filter(e => e.note).reverse();
    const prompt = [
      `Child: ${goal.child.name}, age ${ageLabel(goal.child.dateOfBirth, today)}`,
      `Goal: ${goal.title}`,
      `Today: ${day(today)}`,
      `Target date: ${day(goal.targetDate)}`,
      hit.length
        ? `Checkpoints already hit:\n${hit.map(c => `- ${c.text} (hit ${day(c.hitDate!)})`).join("\n")}`
        : "Checkpoints already hit: none",
      notes.length ? `Recent updates from the parent:\n${notes.map(e => `- ${day(e.date)}: ${e.note}`).join("\n")}` : "",
      context ? `What the parent wants you to know:\n${context}` : "",
      "Draft the remaining checkpoints.",
    ].filter(Boolean).join("\n\n");

    const client = new Anthropic();
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-06-01"],
      fallbacks: [{ model: "claude-opus-4-8" }],
      output_config: { effort: "medium", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "Claude couldn't draft a plan for this goal. Try rewording it, or write the checkpoints yourself." }, { status: 422 });
    }
    const text = response.content.find(b => b.type === "text");
    if (!text || text.type !== "text") throw new Error(`No text in response (stop_reason ${response.stop_reason})`);
    const parsed = JSON.parse(text.text) as { checkpoints: { due_date: string; text: string }[] };

    // Keep only well-formed checkpoints inside (today, target], in date order, and make
    // sure the plan ends on the target date.
    const target = day(goal.targetDate);
    const checkpoints = parsed.checkpoints
      .map(c => ({ due_date: c.due_date, text: c.text.trim() }))
      .filter(c => c.text && parseDay(c.due_date) && c.due_date > day(today) && c.due_date <= target)
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .slice(0, MAX_CHECKPOINTS);
    if (!checkpoints.length) throw new Error("Draft had no usable checkpoints");
    checkpoints[checkpoints.length - 1].due_date = target;

    return NextResponse.json({ checkpoints });
  } catch (err) {
    console.error("POST goal draft-plan failed:", err);
    const status = err instanceof Anthropic.RateLimitError ? 429 : 500;
    return NextResponse.json({ error: "Couldn't draft a plan just now. Try again in a moment." }, { status });
  }
}
