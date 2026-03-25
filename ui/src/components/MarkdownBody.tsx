import { isValidElement, useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import DOMPurify from "dompurify";
import { parseProjectMentionHref } from "@paperclipai/shared";
import { cn } from "../lib/utils";
import { useTheme } from "../context/ThemeContext";
import { AttachmentCard } from "./attachments/AttachmentCard";
import { useAttachment } from "../hooks/useAttachment";

interface MarkdownBodyProps {
  children: string;
  className?: string;
  /** Optional resolver for relative image paths (e.g. within export packages) */
  resolveImageSrc?: (src: string) => string | null;
}

let mermaidLoaderPromise: Promise<typeof import("mermaid").default> | null = null;

function loadMermaid() {
  if (!mermaidLoaderPromise) {
    mermaidLoaderPromise = import("mermaid").then((module) => module.default);
  }
  return mermaidLoaderPromise;
}

function flattenText(value: ReactNode): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((item) => flattenText(item)).join("");
  return "";
}

function extractMermaidSource(children: ReactNode): string | null {
  if (!isValidElement(children)) return null;
  const childProps = children.props as { className?: unknown; children?: ReactNode };
  if (typeof childProps.className !== "string") return null;
  if (!/\blanguage-mermaid\b/i.test(childProps.className)) return null;
  return flattenText(childProps.children).replace(/\n$/, "");
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = match[1];
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function mentionChipStyle(color: string | null): CSSProperties | undefined {
  if (!color) return undefined;
  const rgb = hexToRgb(color);
  if (!rgb) return undefined;
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return {
    borderColor: color,
    backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.22)`,
    color: luminance > 0.55 ? "#111827" : "#f8fafc",
  };
}

function MermaidDiagramBlock({ source, darkMode }: { source: string; darkMode: boolean }) {
  const renderId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSvg(null);
    setError(null);

    loadMermaid()
      .then(async (mermaid) => {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: darkMode ? "dark" : "default",
          fontFamily: "inherit",
          suppressErrorRendering: true,
        });
        const rendered = await mermaid.render(`paperclip-mermaid-${renderId}`, source);
        if (!active) return;
        const cleanSvg = DOMPurify.sanitize(rendered.svg, {
          USE_PROFILES: { svg: true, svgFilters: true },
        });
        setSvg(cleanSvg);
      })
      .catch((err) => {
        if (!active) return;
        const message =
          err instanceof Error && err.message
            ? err.message
            : "Failed to render Mermaid diagram.";
        setError(message);
      });

    return () => {
      active = false;
    };
  }, [darkMode, renderId, source]);

  return (
    <div className="paperclip-mermaid">
      {svg ? (
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <>
          <p className={cn("paperclip-mermaid-status", error && "paperclip-mermaid-status-error")}>
            {error ? `Unable to render Mermaid diagram: ${error}` : "Rendering Mermaid diagram..."}
          </p>
          <pre className="paperclip-mermaid-source">
            <code className="language-mermaid">{source}</code>
          </pre>
        </>
      )}
    </div>
  );
}

function preprocessContent(content: string): string {
  return content.replace(
    /\[\[attachment:([a-f0-9-]{36})\]\]/g,
    (_, id: string) => `[attachment](attachment://${id})`,
  );
}

function parseAttachmentHref(href: string): string | null {
  if (href.startsWith("attachment://")) return href.slice("attachment://".length) || null;
  if (href.startsWith("attachment:")) return href.slice("attachment:".length) || null;
  return null;
}

function InlineAttachment({ attachmentId, label }: { attachmentId: string; label: string }) {
  const { attachment, loading, error } = useAttachment(attachmentId);

  if (error) {
    return (
      <span className="text-xs text-muted-foreground italic">[attachment unavailable]</span>
    );
  }

  if (loading || !attachment) {
    return (
      <span className="text-xs text-muted-foreground">{label || "Loading attachment..."}</span>
    );
  }

  return (
    <AttachmentCard
      attachmentId={attachment.id}
      filename={attachment.filename}
      mimeType={attachment.mimeType}
      sizeBytes={attachment.sizeBytes}
      thumbnailUrl={attachment.thumbnailUrl}
      downloadUrl={attachment.downloadUrl}
      htmlPreviewKey={attachment.htmlPreviewKey}
      status={attachment.status}
      versionNum={attachment.versionNum ?? undefined}
      versionOf={attachment.versionOf}
    />
  );
}

export function MarkdownBody({ children, className, resolveImageSrc }: MarkdownBodyProps) {
  const { theme } = useTheme();
  const components: Components = {
    pre: ({ node: _node, children: preChildren, ...preProps }) => {
      const mermaidSource = extractMermaidSource(preChildren);
      if (mermaidSource) {
        return <MermaidDiagramBlock source={mermaidSource} darkMode={theme === "dark"} />;
      }
      return <pre {...preProps}>{preChildren}</pre>;
    },
    a: ({ href, children: linkChildren }) => {
      const attachmentId = href ? parseAttachmentHref(href) : null;
      if (attachmentId) {
        return (
          <InlineAttachment
            attachmentId={attachmentId}
            label={flattenText(linkChildren)}
          />
        );
      }
      const parsed = href ? parseProjectMentionHref(href) : null;
      if (parsed) {
        const label = linkChildren;
        return (
          <a
            href={`/projects/${parsed.projectId}`}
            className="paperclip-project-mention-chip"
            style={mentionChipStyle(parsed.color)}
          >
            {label}
          </a>
        );
      }
      return (
        <a href={href} target="_blank" rel="noreferrer noopener">
          {linkChildren}
        </a>
      );
    },
  };
  if (resolveImageSrc) {
    components.img = ({ node: _node, src, alt, ...imgProps }) => {
      const resolved = src ? resolveImageSrc(src) : null;
      return <img {...imgProps} src={resolved ?? src} alt={alt ?? ""} />;
    };
  }

  return (
    <div
      className={cn(
        "paperclip-markdown prose prose-sm max-w-none break-words overflow-hidden",
        theme === "dark" && "prose-invert",
        className,
      )}
    >
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {preprocessContent(children)}
      </Markdown>
    </div>
  );
}
