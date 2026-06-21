import { cn } from "@/lib/utils";

interface ChildAvatarProps {
  name: string;
  emoji: string;
  colorCode: string;
  size?: "sm" | "md" | "lg";
  withBg?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { container: "w-8 h-8", text: "text-xs" },
  md: { container: "w-12 h-12", text: "text-lg" },
  lg: { container: "w-16 h-16", text: "text-3xl" },
};

export function ChildAvatar({
  name,
  emoji,
  colorCode,
  size = "md",
  withBg = true,
  className,
}: ChildAvatarProps) {
  const sizes = sizeMap[size];

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full font-semibold shrink-0",
        sizes.container,
        withBg && "ring-2 ring-white/50",
        className
      )}
      style={{
        backgroundColor: `${colorCode}20`,
        borderColor: colorCode,
        border: withBg ? `2px solid ${colorCode}` : undefined,
      }}
      title={name}
    >
      <span className={sizes.text}>{emoji}</span>
    </div>
  );
}
