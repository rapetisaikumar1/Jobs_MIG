import { Download, Eye, FileText } from "lucide-react";
import type { DocumentType } from "@prisma/client";
import { DOCUMENT_TYPE_LABELS } from "@/config/options";
import { formatFileSize } from "@/lib/format";

export type DocumentRow = { id: string; type: DocumentType; fileName: string; sizeBytes: number; mimeType?: string };

/** Secure document links: every request is authorized by /api/documents/[id]. */
export function DocumentLinks({ doc }: { doc: DocumentRow }) {
  const isPdf = doc.mimeType ? doc.mimeType === "application/pdf" : doc.fileName.toLowerCase().endsWith(".pdf");
  return (
    <span className="flex shrink-0 items-center gap-3 text-xs">
      {isPdf && (
        <a href={`/api/documents/${doc.id}?inline=1`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
          <Eye className="size-3.5" aria-hidden /> View
        </a>
      )}
      <a href={`/api/documents/${doc.id}`} className="inline-flex items-center gap-1 hover:underline">
        <Download className="size-3.5" aria-hidden /> Download
      </a>
    </span>
  );
}

export function DocumentList({ documents, emptyText = "No documents." }: { documents: DocumentRow[]; emptyText?: string }) {
  if (!documents.length) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <ul className="divide-y rounded-md border">
      {documents.map((doc) => (
        <li key={doc.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0">
              <span className="block truncate font-medium">{doc.fileName}</span>
              <span className="text-xs text-muted-foreground">
                {DOCUMENT_TYPE_LABELS[doc.type]} · {formatFileSize(doc.sizeBytes)}
              </span>
            </span>
          </span>
          <DocumentLinks doc={doc} />
        </li>
      ))}
    </ul>
  );
}
