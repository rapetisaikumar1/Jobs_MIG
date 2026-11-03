import { cn } from "@/lib/utils";

const PALETTE = [
  "bg-blue-100 text-blue-800",
  "bg-emerald-100 text-emerald-800",
  "bg-amber-100 text-amber-800",
  "bg-violet-100 text-violet-800",
  "bg-rose-100 text-rose-800",
  "bg-cyan-100 text-cyan-800",
  "bg-slate-200 text-slate-800",
];

const SIZES = { xs: "size-6 text-[10px]", sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-14 text-lg" };

/** Initials avatar with a stable color per name (no photos are stored). */
export function Avatar({ name, size = "sm", className }: { name: string; size?: keyof typeof SIZES; className?: string }) {
  const parts = name.trim().split(/\s+/);
  const initials = ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
  const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold", SIZES[size], PALETTE[hash % PALETTE.length], className)}
    >
      {initials}
    </span>
  );
}
