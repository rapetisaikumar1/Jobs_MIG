import * as React from "react";
import Link from "next/link";
import { File, FileImage, FileText, FileType, Folder } from "lucide-react";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Building blocks for the case-file explorer: a bordered panel with a toolbar (search + item
 * count) above a dense table of folders and files.
 */
export function ExplorerPanel({
  toolbar,
  summary,
  children,
}: {
  toolbar?: React.ReactNode;
  summary?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border bg-card shadow-xs">
      {(toolbar || summary) && (
        <div className="flex flex-col gap-2 border-b px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">{toolbar}</div>
          {summary && <div className="text-sm text-muted-foreground sm:text-right">{summary}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

/** "12 items" */
export function itemCount(n: number, singular = "item", plural = `${singular}s`) {
  return `${n.toLocaleString("en-US")} ${n === 1 ? singular : plural}`;
}

/** Icon tile used in the Name column. */
export function ItemIcon({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40 [&_svg]:size-[18px]", className)}
      aria-hidden
    >
      {children}
    </span>
  );
}

export function FolderIcon() {
  return (
    <ItemIcon className="border-amber-200/70 bg-amber-50 text-amber-600">
      <Folder className="fill-amber-400/25" />
    </ItemIcon>
  );
}

/**
 * The Name column: icon, main label and a muted secondary line. When `href` is given the label
 * is the row's main link (ClickableRow opens it when the rest of the row is clicked).
 * `className` overrides the maximum width (pages pass responsive caps so the other columns fit).
 */
export function NameCell({
  icon,
  name,
  href,
  newTab,
  secondary,
  title,
  className,
}: {
  icon: React.ReactNode;
  name: React.ReactNode;
  href?: string;
  newTab?: boolean;
  secondary?: React.ReactNode;
  title?: string;
  className?: string;
}) {
  const labelClass = "block truncate font-medium";
  return (
    <div className={cn("flex min-w-0 max-w-[26rem] items-center gap-3", className)}>
      {icon}
      <div className="min-w-0">
        {href && newTab ? (
          <a href={href} target="_blank" rel="noopener noreferrer" data-row-link title={title} className={cn(labelClass, "hover:underline")}>
            {name}
          </a>
        ) : href && href.startsWith("/api/") ? (
          <a href={href} data-row-link title={title} className={cn(labelClass, "hover:underline")}>
            {name}
          </a>
        ) : href ? (
          <Link href={href} data-row-link title={title} className={cn(labelClass, "hover:underline")}>
            {name}
          </Link>
        ) : (
          <span title={title} className={labelClass}>
            {name}
          </span>
        )}
        {secondary && <div className="truncate text-xs text-muted-foreground">{secondary}</div>}
      </div>
    </div>
  );
}

/** "2 weeks ago", with the exact date and time (in the viewer's time zone) on hover. */
export function RelativeTime({ date, timeZone }: { date: Date | null | undefined; timeZone: string }) {
  if (!date) return <span className="text-muted-foreground">—</span>;
  return (
    <time dateTime={date.toISOString()} title={formatDateTime(date, timeZone)} className="whitespace-nowrap">
      {formatRelativeTime(date)}
    </time>
  );
}

const WORD_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);

/** Icon, colour and short label ("PDF", "DOCX", "PNG") for a stored document. */
export function fileKind(mimeType: string, fileName: string) {
  const ext = /\.([a-z0-9]{1,5})$/i.exec(fileName)?.[1]?.toUpperCase();
  if (mimeType === "application/pdf") return { label: "PDF", Icon: FileText, className: "border-red-200/70 bg-red-50 text-red-600", isPdf: true };
  if (WORD_MIME_TYPES.has(mimeType)) return { label: ext ?? "DOCX", Icon: FileType, className: "border-blue-200/70 bg-blue-50 text-blue-600", isPdf: false };
  if (mimeType.startsWith("image/")) {
    return { label: ext === "JPEG" ? "JPG" : (ext ?? "IMAGE"), Icon: FileImage, className: "border-emerald-200/70 bg-emerald-50 text-emerald-600", isPdf: false };
  }
  return { label: ext ?? "FILE", Icon: File, className: "", isPdf: false };
}

/** Small monospace pill for a file extension. */
export function ExtensionPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded border bg-muted/50 px-1.5 py-px font-mono text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </span>
  );
}
