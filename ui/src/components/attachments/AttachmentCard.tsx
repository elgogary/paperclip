import { useEffect, useState } from "react";
import {
  Download,
  ExternalLink,
  File,
  FileText,
  FileSpreadsheet,
  FileCode,
  Image,
  Loader2,
  AlertTriangle,
  Film,
} from "lucide-react";
import { cn } from "../../lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "../ui/dialog";

export interface AttachmentCardProps {
  attachmentId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  thumbnailUrl?: string | null;
  downloadUrl: string;
  htmlPreviewKey?: string | null;
  status: "uploading" | "assembling" | "processing" | "ready" | "error";
  versionNum?: number;
  versionOf?: string | null;
  className?: string;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function isImage(mime: string): boolean {
  return mime.startsWith("image/");
}

function isVideo(mime: string): boolean {
  return mime.startsWith("video/");
}

function isPdf(mime: string): boolean {
  return mime === "application/pdf";
}

function isSpreadsheet(mime: string): boolean {
  return (
    mime === "text/csv" ||
    mime === "application/vnd.ms-excel" ||
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

function isOfficeDoc(mime: string): boolean {
  return (
    mime.startsWith("application/vnd.openxmlformats-officedocument.") ||
    mime === "application/vnd.ms-excel"
  );
}

function isText(mime: string): boolean {
  return (
    mime.startsWith("text/") ||
    mime === "application/json" ||
    mime === "application/xml" ||
    mime === "application/javascript"
  );
}

function FileTypeIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  if (isImage(mimeType)) return <Image className={className} />;
  if (isVideo(mimeType)) return <Film className={className} />;
  if (isPdf(mimeType)) return <FileText className={className} />;
  if (isOfficeDoc(mimeType)) return <FileSpreadsheet className={className} />;
  if (isText(mimeType)) return <FileCode className={className} />;
  return <File className={className} />;
}

function ProcessingState({ filename }: { filename: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-accent/10 p-3">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{filename}</p>
        <p className="text-xs text-muted-foreground">Processing...</p>
      </div>
    </div>
  );
}

function ErrorState({ filename }: { filename: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
      <AlertTriangle className="h-5 w-5 text-destructive shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{filename}</p>
        <p className="text-xs text-destructive">Processing failed</p>
      </div>
    </div>
  );
}

function VersionBadge({ versionNum }: { versionNum?: number }) {
  if (!versionNum || versionNum <= 1) return null;
  return (
    <span className="ml-1.5 inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
      v{versionNum}
    </span>
  );
}

function ImageCard({ filename, downloadUrl, sizeBytes, versionNum }: AttachmentCardProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-border overflow-hidden bg-accent/5">
      <img
        src={downloadUrl}
        alt={filename}
        loading="lazy"
        className="w-full max-h-96 object-contain bg-accent/10 cursor-pointer"
        onClick={() => setOpen(true)}
      />
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground">
        <span className="truncate">{filename}<VersionBadge versionNum={versionNum} /></span>
        <span className="shrink-0">{formatBytes(sizeBytes)}</span>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl">
          <DialogTitle className="sr-only">{filename}</DialogTitle>
          <img src={downloadUrl} alt={filename} className="w-full h-auto" />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VideoCard({ filename, downloadUrl, thumbnailUrl, sizeBytes, versionNum }: AttachmentCardProps) {
  return (
    <div className="rounded-lg border border-border overflow-hidden bg-accent/5">
      <video
        controls
        preload="none"
        poster={thumbnailUrl ?? undefined}
        className="w-full max-h-96"
        aria-label={filename}
      >
        <source src={downloadUrl} />
      </video>
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground">
        <span className="truncate">{filename}<VersionBadge versionNum={versionNum} /></span>
        <span className="shrink-0">{formatBytes(sizeBytes)}</span>
      </div>
    </div>
  );
}

function PdfCard({ filename, downloadUrl, thumbnailUrl, sizeBytes, versionNum }: AttachmentCardProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-accent/5 p-3">
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={filename}
          className="h-12 w-12 rounded object-cover shrink-0 border border-border"
        />
      ) : (
        <FileText className="h-8 w-8 text-red-500 dark:text-red-400 shrink-0" aria-hidden="true" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{filename}<VersionBadge versionNum={versionNum} /></p>
        <p className="text-xs text-muted-foreground">{formatBytes(sizeBytes)}</p>
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent transition-colors shrink-0"
      >
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        View PDF
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl h-[80vh]">
          <DialogTitle className="sr-only">{filename}</DialogTitle>
          <iframe src={downloadUrl} className="w-full h-full border-0" title={filename} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OfficeCard({ filename, downloadUrl, htmlPreviewKey, sizeBytes, versionNum }: AttachmentCardProps) {
  const [open, setOpen] = useState(false);
  const previewUrl = htmlPreviewKey
    ? `/api/attachments/${htmlPreviewKey}/content`
    : null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-accent/5 p-3">
      <FileSpreadsheet className="h-8 w-8 text-blue-500 dark:text-blue-400 shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{filename}<VersionBadge versionNum={versionNum} /></p>
        <p className="text-xs text-muted-foreground">{formatBytes(sizeBytes)}</p>
      </div>
      {previewUrl ? (
        <>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent transition-colors shrink-0"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            View Document
          </button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-5xl h-[80vh]">
              <DialogTitle className="sr-only">{filename}</DialogTitle>
              <iframe src={previewUrl} className="w-full h-full border-0" title={filename} />
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <a
          href={downloadUrl}
          download={filename}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent transition-colors shrink-0"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Download
        </a>
      )}
    </div>
  );
}

const TEXT_PREVIEW_LIMIT = 10_000;

function TextCard({ filename, mimeType, downloadUrl, sizeBytes, versionNum }: AttachmentCardProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch(downloadUrl, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        if (!mounted) return;
        setContent(
          text.length > TEXT_PREVIEW_LIMIT
            ? text.slice(0, TEXT_PREVIEW_LIMIT) + "\n... [truncated]"
            : text,
        );
      })
      .catch(() => {
        if (mounted) setLoadError(true);
      });
    return () => { mounted = false; };
  }, [downloadUrl]);

  const label = isSpreadsheet(mimeType) ? "Spreadsheet Preview" : null;

  return (
    <div className="rounded-lg border border-border bg-accent/5 overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <FileCode className="h-8 w-8 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {filename}<VersionBadge versionNum={versionNum} />
          </p>
          <p className="text-xs text-muted-foreground">
            {label ? `${label} \u00B7 ` : ""}{formatBytes(sizeBytes)}
          </p>
        </div>
        <a
          href={downloadUrl}
          download={filename}
          aria-label={`Download ${filename}`}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent transition-colors shrink-0"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>
      {content !== null && !loadError && (
        <pre className="max-h-64 overflow-auto border-t border-border bg-muted/30 px-3 py-2 text-xs leading-relaxed">
          <code>{content}</code>
        </pre>
      )}
    </div>
  );
}

function GenericCard({ filename, mimeType, downloadUrl, sizeBytes, versionNum }: AttachmentCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-accent/5 p-3">
      <FileTypeIcon mimeType={mimeType} className="h-8 w-8 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{filename}<VersionBadge versionNum={versionNum} /></p>
        <p className="text-xs text-muted-foreground">{formatBytes(sizeBytes)}</p>
      </div>
      <a
        href={downloadUrl}
        download={filename}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent transition-colors shrink-0"
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        Download
      </a>
    </div>
  );
}

export function AttachmentCard(props: AttachmentCardProps) {
  const { status, mimeType, className } = props;

  if (status === "processing" || status === "uploading" || status === "assembling") {
    return <ProcessingState filename={props.filename} />;
  }
  if (status === "error") {
    return <ErrorState filename={props.filename} />;
  }

  const content = (() => {
    if (isImage(mimeType)) return <ImageCard {...props} />;
    if (isVideo(mimeType)) return <VideoCard {...props} />;
    if (isPdf(mimeType)) return <PdfCard {...props} />;
    if (isSpreadsheet(mimeType)) return <TextCard {...props} />;
    if (isOfficeDoc(mimeType)) return <OfficeCard {...props} />;
    if (isText(mimeType)) return <TextCard {...props} />;
    return <GenericCard {...props} />;
  })();

  return <div className={cn(className)}>{content}</div>;
}
