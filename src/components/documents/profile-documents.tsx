"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import type { DocumentType } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { ActionButton } from "@/components/forms/action-button";
import { FormAlert } from "@/components/forms/form-alert";
import { DocumentUploader } from "@/components/documents/document-uploader";
import { DocumentLinks, type DocumentRow } from "@/components/documents/document-list";
import { DOCUMENT_TYPE_LABELS } from "@/config/options";
import { formatFileSize } from "@/lib/format";
import {
  attachProfileDocumentAction,
  deleteProfileDocumentAction,
  setDefaultResumeAction,
} from "@/modules/documents/actions";

/**
 * Manage profile-level documents (default resume, cover letter, supporting files).
 * Application copies are separate, so changes here never alter past applications.
 */
export function ProfileDocuments({
  documents,
  defaultResumeId,
  candidateId,
  canEdit = true,
}: {
  documents: DocumentRow[];
  defaultResumeId: string | null;
  /** Set when staff manage a candidate's documents. */
  candidateId?: string;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [type, setType] = React.useState<DocumentType>("RESUME");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  return (
    <div className="space-y-4">
      {documents.length ? (
        <ul className="divide-y rounded-md border">
          {documents.map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium">{doc.fileName}</span>
                    {doc.id === defaultResumeId && <Badge tone="dark">Default resume</Badge>}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {DOCUMENT_TYPE_LABELS[doc.type]} · {formatFileSize(doc.sizeBytes)}
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-2">
                <DocumentLinks doc={doc} />
                {canEdit && doc.type === "RESUME" && doc.id !== defaultResumeId && (
                  <ActionButton variant="ghost" size="sm" action={() => setDefaultResumeAction({ documentId: doc.id, candidateId })}>
                    Make default
                  </ActionButton>
                )}
                {canEdit && (
                  <ActionButton
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    confirm={`Remove ${doc.fileName}? Copies already submitted with applications are kept.`}
                    action={() => deleteProfileDocumentAction({ documentId: doc.id, candidateId })}
                  >
                    Remove
                  </ActionButton>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No documents yet. Upload a resume to apply faster.</p>
      )}

      {canEdit && (
        <div className="grid gap-2 rounded-md border bg-muted/30 p-3 sm:grid-cols-[180px_1fr] sm:items-start">
          <Select value={type} onChange={(e) => setType(e.target.value as DocumentType)} aria-label="Document type">
            {(Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]).map((t) => (
              <option key={t} value={t}>
                {DOCUMENT_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
          <DocumentUploader
            key={type}
            id="profile-document-upload"
            type={type}
            candidateId={candidateId}
            value={null}
            onChange={async (file) => {
              if (!file) return;
              setError(null);
              setSuccess(null);
              const result = await attachProfileDocumentAction({
                documentId: file.documentId,
                makeDefault: type === "RESUME",
                candidateId,
              });
              if (!result.ok) setError(result.error);
              else {
                setSuccess(type === "RESUME" ? "Resume uploaded and set as your default." : "Document uploaded.");
                router.refresh();
              }
            }}
          />
        </div>
      )}
      <FormAlert error={error} success={success} />
    </div>
  );
}
