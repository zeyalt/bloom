import { Fragment, type ReactNode } from "react";

// Just enough Markdown for chat answers: paragraphs, "- " / "1. " lists, **bold**,
// *italic*, `code`, and "#" headings shown as a bold line. Builds React elements,
// never HTML strings, so model output can't inject markup.

function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) return <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`") && p.length > 2) return <code key={i} className="px-1 rounded bg-[var(--bg-secondary)] text-[0.85em]">{p.slice(1, -1)}</code>;
    if (p.startsWith("*") && p.endsWith("*") && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
    return <Fragment key={i}>{p}</Fragment>;
  });
}

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "h"; text: string };

function parse(md: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of md.replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
    const last = blocks[blocks.length - 1];
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (!line.trim()) {
      blocks.push({ kind: "p", lines: [] }); // paragraph break
    } else if (bullet) {
      if (last?.kind === "ul") last.items.push(bullet[1]);
      else blocks.push({ kind: "ul", items: [bullet[1]] });
    } else if (numbered) {
      if (last?.kind === "ol") last.items.push(numbered[1]);
      else blocks.push({ kind: "ol", items: [numbered[1]] });
    } else if (heading) {
      blocks.push({ kind: "h", text: heading[1] });
    } else if (last?.kind === "p" && last.lines.length) {
      last.lines.push(line);
    } else {
      blocks.push({ kind: "p", lines: [line] });
    }
  }
  return blocks.filter(b => !(b.kind === "p" && b.lines.length === 0));
}

export function ChatMarkdown({ text }: { text: string }) {
  return (
    <div className="space-y-2">
      {parse(text).map((b, i) => {
        if (b.kind === "h") return <p key={i} className="font-semibold">{inline(b.text)}</p>;
        if (b.kind === "ul")
          return (
            <ul key={i} className="list-disc pl-5 space-y-0.5 marker:text-[var(--text-muted)]">
              {b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}
            </ul>
          );
        if (b.kind === "ol")
          return (
            <ol key={i} className="list-decimal pl-5 space-y-0.5 marker:text-[var(--text-muted)]">
              {b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}
            </ol>
          );
        return (
          <p key={i}>
            {b.lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(l)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
