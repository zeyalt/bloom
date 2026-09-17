/** Combined reflection text (legacy `learned` + `diary_notes` stored separately). */
export function getReflectionText(
  learned?: string | null,
  diaryNotes?: string | null
): string {
  const a = learned?.trim() ?? "";
  const b = diaryNotes?.trim() ?? "";
  if (a && b) return `${a}\n\n${b}`;
  return a || b;
}

export function hasReflection(
  learned?: string | null,
  diaryNotes?: string | null
): boolean {
  return getReflectionText(learned, diaryNotes).length > 0;
}
