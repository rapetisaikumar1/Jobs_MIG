"use client";

import * as React from "react";
import { FileUp, Loader2, X } from "lucide-react";
import type { DocumentType } from "@prisma/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatFileSize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { acceptAttribute, allowedLabel, checkUpload } from "@/modules/documents/file-rules";
import { requestUploadAction } from "@/modules/documents/actions";

export type UploadedFile = { documentId: string; fileName: string; sizeBytes: number; type: DocumentType };

/**
 * Uploads a file straight to private Supabase Storage using a short-lived signed
 * upload URL issued by the server. Returns the pending document id to the parent
 * form; the server verifies and activates it when the form is submitted.
 */
export function DocumentUploader({
  id,
  type,
  candidateId,
  value,
  onChange,
  invalid,
  onStart,
}: {
  id: string;
  type: DocumentType;
  candidateId?: string;
  value: UploadedFile | null;
  onChange: (file: UploadedFile | null) => void;
  invalid?: boolean;
  /** Called when a new file is picked, so parents can clear earlier outcome messages. */
  onStart?: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    onStart?.();
    const check = checkUpload(type, file.name, file.size);
    if (!check.ok) return setError(check.error);

    setBusy(true);
    try {
      const ticket = await requestUploadAction({ type, fileName: file.name, sizeBytes: file.size, candidateId });
      if (!ticket.ok) return setError(ticket.error);
      const supabase = createSupabaseBrowserClient();
      const { error: uploadError } = await supabase.storage
        .from(ticket.data.bucket)
        .uploadToSignedUrl(ticket.data.path, ticket.data.token, file, { contentType: check.mimeType });
      if (uploadError) return setError("The upload failed. Please check your connection and try again.");
      onChange({ documentId: ticket.data.documentId, fileName: ticket.data.fileName, sizeBytes: file.size, type });
    } catch {
      setError("The upload failed. Please try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/50 px-3 py-2 text-sm">
        <span className="min-w-0 truncate">
          <span className="font-medium">{value.fileName}</span>
          <span className="ml-2 text-muted-foreground">{formatFileSize(value.sizeBytes)}</span>
        </span>
        <button type="button" onClick={() => onChange(null)} className="text-muted-foreground hover:text-foreground" aria-label="Remove file">
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <label
        htmlFor={id}
        className={cn(
          "flex min-w-0 cursor-pointer items-center gap-3 rounded-md border border-dashed bg-background px-3 py-3 text-sm transition-colors hover:border-primary/50 hover:bg-muted/50",
          invalid && "border-destructive",
          busy && "pointer-events-none opacity-70",
        )}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileUp className="size-4" aria-hidden />}
        </span>
        <span className="min-w-0">
          <span className="block font-medium">{busy ? "Uploading…" : "Choose a file"}</span>
          <span className="block text-xs text-muted-foreground">{allowedLabel(type)} · max 10 MB</span>
        </span>
      </label>
      <input
        ref={inputRef}
        id={id}
        type="file"
        className="sr-only"
        accept={acceptAttribute(type)}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** Several optional uploads of one type (supporting documents). */
export function MultiDocumentUploader({
  id,
  type,
  candidateId,
  value,
  onChange,
  max = 5,
}: {
  id: string;
  type: DocumentType;
  candidateId?: string;
  value: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  max?: number;
}) {
  return (
    <div className="space-y-2">
      {value.map((file) => (
        <DocumentUploader
          key={file.documentId}
          id={`${id}-${file.documentId}`}
          type={type}
          value={file}
          onChange={() => onChange(value.filter((f) => f.documentId !== file.documentId))}
        />
      ))}
      {value.length < max && (
        <DocumentUploader
          id={`${id}-new`}
          type={type}
          candidateId={candidateId}
          value={null}
          onChange={(file) => file && onChange([...value, file])}
        />
      )}
    </div>
  );
}
