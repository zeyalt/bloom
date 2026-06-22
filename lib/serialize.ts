// Prisma returns camelCase keys (e.g. avatarKey, dateOfBirth), but the
// frontend (originally built for Supabase) reads snake_case (avatar_key,
// date_of_birth). This recursively converts API response objects to
// snake_case so the two stay in sync. Dates are left intact for
// NextResponse.json to serialise to ISO strings.

function toSnake(key: string): string {
  return key.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
}

export function serialize<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(serialize) as unknown as T;
  }
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        toSnake(k),
        serialize(v),
      ])
    ) as T;
  }
  return value;
}
