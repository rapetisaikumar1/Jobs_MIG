"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, type ButtonProps } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";

/**
 * Runs a server action from a button (optionally after confirmation) and shows the
 * outcome inline. Used for one-click actions like publishing a job.
 */
export function ActionButton({
  action,
  confirm,
  children,
  onDone,
  ...props
}: Omit<ButtonProps, "onClick" | "action"> & {
  action: () => Promise<ActionResult<unknown>>;
  confirm?: string;
  onDone?: (result: ActionResult<unknown>) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        {...props}
        disabled={pending || props.disabled}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          startTransition(async () => {
            const result = await action();
            setMessage(result.ok ? (result.message ? { ok: true, text: result.message } : null) : { ok: false, text: result.error });
            onDone?.(result);
            if (result.ok) router.refresh();
          });
        }}
      >
        {pending ? "Working…" : children}
      </Button>
      {message && (
        <span role="status" className={message.ok ? "text-xs text-success" : "text-xs text-destructive"}>
          {message.text}
        </span>
      )}
    </span>
  );
}
