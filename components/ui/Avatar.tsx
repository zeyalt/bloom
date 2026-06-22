"use client";

import { cn } from "@/lib/utils";

// ── Parametric kid avatars ───────────────────────────────────────────────
// Each avatar is a small config rendered through one SVG template, giving a
// consistent illustrated style with variety. Stored by `key` on the child.

interface AvatarConfig {
  key: string;
  bg: string;      // background circle
  skin: string;    // face
  hair: string;    // hair colour
  hairStyle: "short" | "bangs" | "ponytail" | "curly" | "buzz" | "bun";
  glasses?: boolean;
}

export const AVATARS: AvatarConfig[] = [
  { key: "a1", bg: "#DBEAFE", skin: "#F4C9A8", hair: "#3F2A1D", hairStyle: "short" },
  { key: "a2", bg: "#FCE7F3", skin: "#F1B98E", hair: "#5A3A22", hairStyle: "ponytail" },
  { key: "a3", bg: "#DCFCE7", skin: "#E8B48C", hair: "#1F1A17", hairStyle: "curly" },
  { key: "a4", bg: "#FEF3C7", skin: "#F4C9A8", hair: "#8B5A2B", hairStyle: "bangs" },
  { key: "a5", bg: "#EDE9FE", skin: "#D89A6E", hair: "#241712", hairStyle: "buzz" },
  { key: "a6", bg: "#CFFAFE", skin: "#F1B98E", hair: "#6B4423", hairStyle: "bun" },
  { key: "a7", bg: "#FFE4E6", skin: "#E8B48C", hair: "#2B1B12", hairStyle: "short", glasses: true },
  { key: "a8", bg: "#E0F2FE", skin: "#F4C9A8", hair: "#A45A2A", hairStyle: "bangs", glasses: true },
  { key: "a9", bg: "#F0FDF4", skin: "#D89A6E", hair: "#1F1A17", hairStyle: "ponytail" },
  { key: "a10", bg: "#FAE8FF", skin: "#F1B98E", hair: "#4A2F1B", hairStyle: "curly" },
  { key: "a11", bg: "#DBEAFE", skin: "#C8895E", hair: "#0E0A08", hairStyle: "bun" },
  { key: "a12", bg: "#FEF9C3", skin: "#F4C9A8", hair: "#C77C2E", hairStyle: "ponytail" },
  { key: "a13", bg: "#DCFCE7", skin: "#F1B98E", hair: "#3F2A1D", hairStyle: "buzz", glasses: true },
  { key: "a14", bg: "#FCE7F3", skin: "#D89A6E", hair: "#5A3A22", hairStyle: "short" },
  { key: "a15", bg: "#E0E7FF", skin: "#E8B48C", hair: "#1F1A17", hairStyle: "curly", glasses: true },
  { key: "a16", bg: "#FFEDD5", skin: "#C8895E", hair: "#241712", hairStyle: "bangs" },
  { key: "a17", bg: "#CCFBF1", skin: "#F4C9A8", hair: "#8B5A2B", hairStyle: "bun" },
  { key: "a18", bg: "#F3E8FF", skin: "#E8B48C", hair: "#6B4423", hairStyle: "short" },
  { key: "a19", bg: "#FFE4E6", skin: "#D89A6E", hair: "#0E0A08", hairStyle: "ponytail" },
  { key: "a20", bg: "#ECFCCB", skin: "#F1B98E", hair: "#A45A2A", hairStyle: "buzz" },
];

function Hair({ style, color }: { style: AvatarConfig["hairStyle"]; color: string }) {
  switch (style) {
    case "short":
      return <path d="M14 30 Q32 6 50 30 Q50 18 32 14 Q14 18 14 30 Z" fill={color} />;
    case "bangs":
      return (
        <>
          <path d="M13 32 Q32 4 51 32 Q51 16 32 13 Q13 16 13 32 Z" fill={color} />
          <path d="M20 24 Q26 32 32 25 Q38 32 44 24 L44 20 L20 20 Z" fill={color} />
        </>
      );
    case "ponytail":
      return (
        <>
          <circle cx="48" cy="30" r="6" fill={color} />
          <path d="M14 30 Q32 6 50 30 Q50 18 32 14 Q14 18 14 30 Z" fill={color} />
        </>
      );
    case "curly":
      return (
        <>
          <circle cx="18" cy="22" r="7" fill={color} />
          <circle cx="28" cy="15" r="7" fill={color} />
          <circle cx="38" cy="15" r="7" fill={color} />
          <circle cx="46" cy="22" r="7" fill={color} />
          <path d="M16 30 Q32 16 48 30 L48 24 L16 24 Z" fill={color} />
        </>
      );
    case "buzz":
      return <path d="M16 28 Q32 12 48 28 Q48 20 32 17 Q16 20 16 28 Z" fill={color} opacity="0.85" />;
    case "bun":
      return (
        <>
          <circle cx="32" cy="9" r="6" fill={color} />
          <path d="M15 30 Q32 8 49 30 Q49 18 32 15 Q15 18 15 30 Z" fill={color} />
        </>
      );
  }
}

export function Avatar({
  avatarKey,
  fallbackEmoji,
  size = 48,
  className,
}: {
  avatarKey?: string | null;
  fallbackEmoji?: string;
  size?: number;
  className?: string;
}) {
  const cfg = AVATARS.find(a => a.key === avatarKey);

  // No avatar chosen → fall back to the emoji in a neutral circle
  if (!cfg) {
    return (
      <div
        className={cn("rounded-full flex items-center justify-center bg-[var(--bg-secondary)]", className)}
        style={{ width: size, height: size, fontSize: size * 0.5 }}
      >
        {fallbackEmoji || "🌱"}
      </div>
    );
  }

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn("rounded-full shrink-0", className)}
      role="img"
      aria-label="Child avatar"
    >
      <circle cx="32" cy="32" r="32" fill={cfg.bg} />
      {/* neck + face */}
      <rect x="27" y="40" width="10" height="10" rx="4" fill={cfg.skin} />
      <circle cx="32" cy="30" r="14" fill={cfg.skin} />
      {/* ears */}
      <circle cx="18" cy="31" r="3" fill={cfg.skin} />
      <circle cx="46" cy="31" r="3" fill={cfg.skin} />
      <Hair style={cfg.hairStyle} color={cfg.hair} />
      {/* eyes */}
      {cfg.glasses ? (
        <>
          <circle cx="26" cy="30" r="4.5" fill="none" stroke="#3A3A3A" strokeWidth="1.5" />
          <circle cx="38" cy="30" r="4.5" fill="none" stroke="#3A3A3A" strokeWidth="1.5" />
          <line x1="30.5" y1="30" x2="33.5" y2="30" stroke="#3A3A3A" strokeWidth="1.5" />
          <circle cx="26" cy="30" r="1.6" fill="#2A2A2A" />
          <circle cx="38" cy="30" r="1.6" fill="#2A2A2A" />
        </>
      ) : (
        <>
          <circle cx="26" cy="30" r="1.8" fill="#2A2A2A" />
          <circle cx="38" cy="30" r="1.8" fill="#2A2A2A" />
        </>
      )}
      {/* cheeks */}
      <circle cx="23" cy="35" r="2" fill="#F7A8A8" opacity="0.55" />
      <circle cx="41" cy="35" r="2" fill="#F7A8A8" opacity="0.55" />
      {/* smile */}
      <path d="M28 36 Q32 40 36 36" fill="none" stroke="#B5654A" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function AvatarPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (key: string) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {AVATARS.map(a => (
        <button
          key={a.key}
          type="button"
          onClick={() => onChange(a.key)}
          className={cn(
            "rounded-full p-0.5 transition-all duration-150",
            value === a.key
              ? "ring-2 ring-[var(--accent-primary)] ring-offset-1"
              : "ring-1 ring-transparent hover:ring-[var(--border)]"
          )}
          aria-label={`Select avatar ${a.key}`}
          aria-pressed={value === a.key}
        >
          <Avatar avatarKey={a.key} size={44} />
        </button>
      ))}
    </div>
  );
}
