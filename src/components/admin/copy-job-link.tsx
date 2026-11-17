"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Copies text, falling back to a selected textarea + execCommand where the Clipboard API is unavailable (e.g. plain http). */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission denied or unsupported: try the fallback below.
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/** Read-only public job URL with a "Copy link" button, for sharing a job with candidates. */
export function CopyJobLink({ url, hint }: { url: string; hint?: React.ReactNode }) {
  const [state, setState] = React.useState<"idle" | "copied" | "failed">("idle");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  React.useEffect(() => () => clearTimeout(timer.current), []);

  async function onCopy() {
    const ok = await copyText(url);
    if (!ok) inputRef.current?.select(); // let the user press Ctrl/Cmd+C
    setState(ok ? "copied" : "failed");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          readOnly
          value={url}
          aria-label="Shareable job link"
          className="min-w-0 flex-1 font-mono text-xs"
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button type="button" variant="outline" onClick={onCopy} className="shrink-0">
          {state === "copied" ? <Check aria-hidden className="text-success" /> : <Copy aria-hidden />}
          {state === "copied" ? "Copied!" : "Copy link"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {state === "failed" ? "Could not copy automatically. The link is selected: press Ctrl+C (or ⌘C) to copy it." : hint}
      </p>
    </div>
  );
}
