"use client";

import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Small spinner shown inside a <Link> from the moment it is clicked until the next page renders. */
export function LinkPending({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 aria-hidden className={cn("size-3.5 shrink-0 animate-spin text-muted-foreground", className)} /> : null;
}
