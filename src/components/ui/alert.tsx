import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const alertVariants = cva("flex gap-3 rounded-md border p-3 text-sm [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0", {
  variants: {
    variant: {
      info: "border-blue-200 bg-blue-50 text-blue-900",
      success: "border-green-200 bg-green-50 text-green-900",
      error: "border-red-200 bg-red-50 text-red-900",
      neutral: "border-border bg-muted text-foreground",
    },
  },
  defaultVariants: { variant: "info" },
});

export function Alert({
  className,
  variant,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>) {
  const Icon = variant === "success" ? CheckCircle2 : variant === "error" ? AlertCircle : Info;
  return (
    <div role={variant === "error" ? "alert" : "status"} className={cn(alertVariants({ variant }), className)} {...props}>
      <Icon aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
