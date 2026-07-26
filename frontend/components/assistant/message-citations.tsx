"use client";

import { memo, useState } from "react";
import { ExternalLink, FileText, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { documentsApi } from "@/lib/api/documents";
import type { Citation } from "@/lib/types/conversations";

interface MessageCitationsProps {
  citations: Citation[];
}

export const MessageCitations = memo(function MessageCitations({ citations }: MessageCitationsProps) {
  const [openingId, setOpeningId] = useState<string | null>(null);

  if (citations.length === 0) {
    return <p className="mt-3 text-xs text-muted-foreground">No source citations available.</p>;
  }

  const openDocument = async (citation: Citation) => {
    const sourceWindow = window.open("", "_blank");
    if (sourceWindow) sourceWindow.opener = null;
    setOpeningId(citation.document_id);
    try {
      const blob = await documentsApi.download(citation.document_id);
      const objectUrl = URL.createObjectURL(blob);
      if (sourceWindow) {
        sourceWindow.location.href = objectUrl;
      } else {
        window.location.assign(objectUrl);
      }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      sourceWindow?.close();
      toast.error(error instanceof Error ? error.message : "The referenced document is unavailable");
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <details className="mt-4 rounded-xl border bg-muted/30 px-3 py-2 text-sm">
      <summary className="cursor-pointer select-none font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Sources ({citations.length})
      </summary>
      <ul className="mt-2 space-y-1.5" aria-label="Response sources">
        {citations.map((citation) => (
          <li key={`${citation.document_id}-${citation.chunk_index}`}>
            <button
              type="button"
              onClick={() => void openDocument(citation)}
              disabled={openingId === citation.document_id}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              aria-label={`Open source document ${citation.title}`}
            >
              {openingId === citation.document_id ? <LoaderCircle className="size-4 shrink-0 animate-spin" /> : <FileText className="size-4 shrink-0 text-primary" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{citation.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{citation.filename}</span>
              </span>
              <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
});
