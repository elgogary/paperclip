// @vitest-environment node

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AttachmentCard, formatBytes } from "../AttachmentCard";

function render(props: Parameters<typeof AttachmentCard>[0]): string {
  return renderToStaticMarkup(<AttachmentCard {...props} />);
}

const baseProps = {
  attachmentId: "att-123",
  filename: "photo.png",
  mimeType: "image/png",
  sizeBytes: 1_258_291,
  downloadUrl: "/api/attachments/att-123/content",
  status: "ready" as const,
};

describe("AttachmentCard", () => {
  it("renders image inline for image/png", () => {
    const html = render(baseProps);
    expect(html).toContain("<img");
    expect(html).toContain('src="/api/attachments/att-123/content"');
    expect(html).toContain('alt="photo.png"');
    expect(html).toContain("loading=\"lazy\"");
  });

  it("renders video player for video/mp4", () => {
    const html = render({
      ...baseProps,
      filename: "demo.mp4",
      mimeType: "video/mp4",
      thumbnailUrl: "/api/attachments/att-123/thumbnail",
    });
    expect(html).toContain("<video");
    expect(html).toContain("controls");
    expect(html).toContain('preload="none"');
    expect(html).toContain('poster="/api/attachments/att-123/thumbnail"');
    expect(html).toContain("<source");
  });

  it("renders PDF card with View PDF button", () => {
    const html = render({
      ...baseProps,
      filename: "report.pdf",
      mimeType: "application/pdf",
    });
    expect(html).toContain("View PDF");
    expect(html).toContain("report.pdf");
    expect(html).not.toContain("<img");
  });

  it("renders PDF card with thumbnail when provided", () => {
    const html = render({
      ...baseProps,
      filename: "report.pdf",
      mimeType: "application/pdf",
      thumbnailUrl: "/api/attachments/att-123/thumbnail",
    });
    expect(html).toContain('src="/api/attachments/att-123/thumbnail"');
    expect(html).toContain("View PDF");
  });

  it("renders Office document card", () => {
    const html = render({
      ...baseProps,
      filename: "budget.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    expect(html).toContain("View Document");
    expect(html).toContain("budget.xlsx");
  });

  it("renders text/code card with View and Download", () => {
    const html = render({
      ...baseProps,
      filename: "config.json",
      mimeType: "application/json",
    });
    expect(html).toContain("View");
    expect(html).toContain('download="config.json"');
  });

  it("renders generic card with Download button for unknown types", () => {
    const html = render({
      ...baseProps,
      filename: "archive.7z",
      mimeType: "application/x-7z-compressed",
    });
    expect(html).toContain("Download");
    expect(html).toContain("archive.7z");
  });

  it("shows spinner for status=processing", () => {
    const html = render({ ...baseProps, status: "processing" });
    expect(html).toContain("Processing...");
    expect(html).not.toContain("<img");
  });

  it("shows spinner for status=uploading", () => {
    const html = render({ ...baseProps, status: "uploading" });
    expect(html).toContain("Processing...");
  });

  it("shows error state for status=error", () => {
    const html = render({ ...baseProps, status: "error" });
    expect(html).toContain("Processing failed");
    expect(html).not.toContain("<img");
  });

  it("renders download link pointing to correct URL", () => {
    const html = render({
      ...baseProps,
      filename: "data.csv",
      mimeType: "text/csv",
    });
    expect(html).toContain('href="/api/attachments/att-123/content"');
  });
});

describe("formatBytes", () => {
  it("formats 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats bytes", () => {
    expect(formatBytes(500)).toBe("500 B");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(348_160)).toBe("340.0 KB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(1_258_291)).toBe("1.2 MB");
  });

  it("formats gigabytes", () => {
    expect(formatBytes(2_147_483_648)).toBe("2.0 GB");
  });
});
