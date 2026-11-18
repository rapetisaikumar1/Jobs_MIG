import type { WorkArrangement } from "@prisma/client";
import { Building2, Globe, Repeat, type LucideIcon } from "lucide-react";
import { WORK_ARRANGEMENT_LABELS } from "@/config/options";
import { cn } from "@/lib/utils";

const STYLES: Record<WorkArrangement, { icon: LucideIcon; className: string }> = {
  REMOTE: { icon: Globe, className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  HYBRID: { icon: Repeat, className: "border-sky-200 bg-sky-50 text-sky-800" },
  ONSITE: { icon: Building2, className: "border-violet-200 bg-violet-50 text-violet-800" },
};

/** Remote / Hybrid / On-site label shown before a job's location on the job portal. */
export function WorkArrangementBadge({
  arrangement,
  size = "md",
  className,
}: {
  arrangement: WorkArrangement;
  size?: "sm" | "md";
  className?: string;
}) {
  const style = STYLES[arrangement];
  if (!style) return null;
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border font-medium whitespace-nowrap",
        size === "sm" ? "px-1.5 py-px text-[11px]" : "px-2 py-0.5 text-xs",
        style.className,
        className,
      )}
    >
      <Icon className={size === "sm" ? "size-3" : "size-3.5"} strokeWidth={2} aria-hidden />
      {WORK_ARRANGEMENT_LABELS[arrangement]}
    </span>
  );
}
