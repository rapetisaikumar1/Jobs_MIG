import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  icon,
  href,
  hint,
}: {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  href?: string;
  hint?: string;
}) {
  const body = (
    <Card className="flex h-full items-center gap-4 p-5 transition-all hover:border-foreground/20 hover:shadow-md">
      {icon && <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border bg-surface [&_svg]:size-5">{icon}</span>}
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums leading-tight">
          {typeof value === "number" ? value.toLocaleString("en-US") : value}
        </p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
