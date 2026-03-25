import { useCallback, useRef, useState, type DragEvent } from "react";
import { Upload, AlertTriangle, RotateCcw } from "lucide-react";
import { attachmentsApi } from "../../api/attachments";
import { cn } from "../../lib/utils";

interface AttachmentUploadZoneProps {
  issueId: string;
  companyId: string;
  onAttached: (attachmentId: string, filename: string, mimeType: string) => void;
}

const CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB chunks
const MAX_RETRIES = 3;

async function uploadChunkWithRetry(
  id: string,
  chunk: Blob,
  start: number,
  total: number,
  attempt = 0,
): Promise<void> {
  try {
    await attachmentsApi.uploadChunk(id, chunk, start, total);
  } catch (err) {
    if (attempt >= MAX_RETRIES) throw err;
    await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 500));
    return uploadChunkWithRetry(id, chunk, start, total, attempt + 1);
  }
}

export function AttachmentUploadZone({
  issueId,
  companyId,
  onAttached,
}: AttachmentUploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastFileRef = useRef<File | null>(null);
  const failedOffsetRef = useRef<number>(0);
  const currentAttachmentIdRef = useRef<string | null>(null);

  const uploadFile = useCallback(
    async (file: File, resumeOffset = 0, existingAttachmentId?: string) => {
      setUploading(true);
      setProgress(resumeOffset > 0 ? Math.round((resumeOffset / file.size) * 100) : 0);
      setError(null);
      lastFileRef.current = file;

      let attachmentId = existingAttachmentId;

      try {
        if (!attachmentId) {
          const result = await attachmentsApi.initUpload({
            issueId,
            companyId,
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
            sizeBytes: file.size,
          });
          attachmentId = result.attachmentId;
        }
        currentAttachmentIdRef.current = attachmentId;

        let offset = resumeOffset;
        while (offset < file.size) {
          const end = Math.min(offset + CHUNK_SIZE, file.size);
          const chunk = file.slice(offset, end);
          await uploadChunkWithRetry(attachmentId, chunk, offset, file.size);
          offset = end;
          setProgress(Math.round((offset / file.size) * 100));
        }

        await attachmentsApi.completeUpload(attachmentId);
        currentAttachmentIdRef.current = null;
        onAttached(attachmentId, file.name, file.type || "application/octet-stream");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        failedOffsetRef.current = Math.max(
          0,
          Math.floor(progress / 100 * file.size / CHUNK_SIZE) * CHUNK_SIZE,
        );
        // Clean up orphaned attachment record on final failure
        if (attachmentId) {
          attachmentsApi.delete(attachmentId).catch(() => {});
          currentAttachmentIdRef.current = null;
        }
        setError(message);
      } finally {
        setUploading(false);
      }
    },
    [issueId, companyId, onAttached, progress],
  );

  function handleRetry() {
    const file = lastFileRef.current;
    if (file) {
      void uploadFile(file);
    }
  }

  function handleDragEnter(evt: DragEvent) {
    evt.preventDefault();
    evt.stopPropagation();
    setDragActive(true);
  }

  function handleDragLeave(evt: DragEvent) {
    evt.preventDefault();
    evt.stopPropagation();
    if (evt.currentTarget.contains(evt.relatedTarget as Node | null)) return;
    setDragActive(false);
  }

  function handleDragOver(evt: DragEvent) {
    evt.preventDefault();
    evt.stopPropagation();
  }

  function handleDrop(evt: DragEvent) {
    evt.preventDefault();
    evt.stopPropagation();
    setDragActive(false);

    const file = evt.dataTransfer?.files?.[0];
    if (file) void uploadFile(file);
  }

  function handleFileSelect(evt: React.ChangeEvent<HTMLInputElement>) {
    const file = evt.target.files?.[0];
    if (file) void uploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload file — drag and drop or click to browse"
        aria-busy={uploading}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !uploading) {
            fileInputRef.current?.click();
          }
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 transition-colors cursor-pointer",
          dragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground/40 hover:bg-accent/5",
          uploading && "pointer-events-none opacity-60",
        )}
      >
        <Upload className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <p className="text-xs text-muted-foreground">
          {uploading ? "Uploading..." : "Drop a file or click to browse"}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          disabled={uploading}
        />
      </div>

      {uploading && (
        <div className="h-1.5 w-full rounded-full bg-accent/20 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-accent transition-colors shrink-0"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
