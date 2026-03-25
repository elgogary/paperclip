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

export interface AttachmentCardProps {
  attachmentId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  thumbnailUrl?: string | null;
  downloadUrl: string;
  status: "processing" | "uploading" | "assembling" | "ready" | "error";
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

function isOfficeDoc(mime: string): boolean {
  return mime.startsWith("application/vnd.openxmlformats-officedocument.");
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
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground shrink-0" />
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
      <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{filename}</p>
        <p className="text-xs text-destructive">Processing failed</p>
      </div>
    </div>
  );
}

function ImageCard({ filename, downloadUrl, sizeBytes }: AttachmentCardProps) {
  return (
    <div className="rounded-lg border border-border overflow-hidden bg-accent/5">
      <a href={downloadUrl} target="_blank" rel="noreferrer">
        <img
          src={downloadUrl}
          alt={filename}
          loading="lazy"
          className="w-full max-h-96 object-contain bg-accent/10"
        />
      </a>
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground">
        <span className="truncate">{filename}</span>
        <span className="shrink-0">{formatBytes(sizeBytes)}</span>
      </div>
    </div>
  );
}

function VideoCard({ filename, downloadUrl, thumbnailUrl, sizeBytes }: AttachmentCardProps) {
  return (
    <div className="rounded-lg border border-border overflow-hidden bg-accent/5">
      <video
        controls
        preload="none"
        poster={thumbnailUrl ?? undefined}
        className="w-full max-h-96"
      >
        <source src={downloadUrl} />
      </video>
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground">
        <span className="truncate">{filename}</span>
        <span className="shrink-0">{formatBytes(sizeBytes)}</span>
      </div>
    </div>
  );
}

function PdfCard({ filename, downloadUrl, thumbnailUrl, sizeBytes }: AttachmentCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-accent/5 p-3">
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={filename}
          className="h-12 w-12 rounded object-cover shrink-0 border border-border"
        />
      ) : (
        <FileText className="h-8 w-8 text-red-500 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{filename}</p>
        <p className="text-xs text-muted-foreground">{formatBytes(sizeBytes)}</p>
      </div>
      <a
        href={downloadUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent transition-colors shrink-0"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        View PDF
      </a>
    </div>
  );
}

function OfficeCard({ filename, downloadUrl, sizeBytes }: AttachmentCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-accent/5 p-3">
      <FileSpreadsheet className="h-8 w-8 text-blue-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{filename}</p>
        <p className="text-xs text-muted-foreground">{formatBytes(sizeBytes)}</p>
      </div>
      <a
        href={downloadUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent transition-colors shrink-0"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        View Document
      </a>
    </div>
  );
}

function TextCard({ filename, downloadUrl, sizeBytes }: AttachmentCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-accent/5 p-3">
      <FileCode className="h-8 w-8 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{filename}</p>
        <p className="text-xs text-muted-foreground">{formatBytes(sizeBytes)}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <a
          href={downloadUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          View
        </a>
        <a
          href={downloadUrl}
          download={filename}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

function GenericCard({ filename, mimeType, downloadUrl, sizeBytes }: AttachmentCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-accent/5 p-3">
      <FileTypeIcon mimeType={mimeType} className="h-8 w-8 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{filename}</p>
        <p className="text-xs text-muted-foreground">{formatBytes(sizeBytes)}</p>
      </div>
      <a
        href={downloadUrl}
        download={filename}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent transition-colors shrink-0"
      >
        <Download className="h-3.5 w-3.5" />
        Download
      </a>
    </div>
  );
}

export function AttachmentCard(props: AttachmentCardProps) {
  const { status, mimeType, className } = props as AttachmentCardProps & { className?: string };

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
    if (isOfficeDoc(mimeType)) return <OfficeCard {...props} />;
    if (isText(mimeType)) return <TextCard {...props} />;
    return <GenericCard {...props} />;
  })();

  return <div className={cn(className)}>{content}</div>;
}
