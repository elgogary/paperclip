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

  it("renders video with aria-label", () => {
    const html = render({
      ...baseProps,
      filename: "demo.mp4",
      mimeType: "video/mp4",
    });
    expect(html).toContain('aria-label="demo.mp4"');
  });

  it("renders PDF card with View PDF button", () => {
    const html = render({
      ...baseProps,
      filename: "report.pdf",
      mimeType: "application/pdf",
    });
    expect(html).toContain("View PDF");
    expect(html).toContain("report.pdf");
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

  it("renders PDF icon with dark mode class", () => {
    const html = render({
      ...baseProps,
      filename: "report.pdf",
      mimeType: "application/pdf",
    });
    expect(html).toContain("dark:text-red-400");
  });

  it("renders Office document card with htmlPreviewKey showing View Document button", () => {
    const html = render({
      ...baseProps,
      filename: "proposal.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      htmlPreviewKey: "preview-key-123",
    });
    expect(html).toContain("View Document");
    expect(html).toContain("proposal.docx");
  });

  it("renders Office document card without htmlPreviewKey showing Download button", () => {
    const html = render({
      ...baseProps,
      filename: "proposal.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      htmlPreviewKey: null,
    });
    expect(html).toContain("Download");
    expect(html).not.toContain("View Document");
  });

  it("renders Office icon with dark mode class for word docs", () => {
    const html = render({
      ...baseProps,
      filename: "report.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      htmlPreviewKey: "preview-123",
    });
    expect(html).toContain("dark:text-blue-400");
  });

  it("renders text/plain card with pre/code block structure", () => {
    const html = render({
      ...baseProps,
      filename: "readme.txt",
      mimeType: "text/plain",
    });
    expect(html).toContain("readme.txt");
    expect(html).toContain('download="readme.txt"');
  });

  it("renders text/csv with Spreadsheet Preview label", () => {
    const html = render({
      ...baseProps,
      filename: "data.csv",
      mimeType: "text/csv",
    });
    expect(html).toContain("Spreadsheet Preview");
    expect(html).toContain("data.csv");
  });

  it("renders application/vnd.ms-excel with Spreadsheet Preview label", () => {
    const html = render({
      ...baseProps,
      filename: "legacy.xls",
      mimeType: "application/vnd.ms-excel",
    });
    expect(html).toContain("Spreadsheet Preview");
    expect(html).toContain("legacy.xls");
  });

  it("renders application/json with View and Download", () => {
    const html = render({
      ...baseProps,
      filename: "config.json",
      mimeType: "application/json",
    });
    expect(html).toContain("config.json");
    expect(html).toContain('download="config.json"');
  });

  it("renders download-only link with aria-label", () => {
    const html = render({
      ...baseProps,
      filename: "config.json",
      mimeType: "application/json",
    });
    expect(html).toContain('aria-label="Download config.json"');
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

  it("shows spinner for status=assembling", () => {
    const html = render({ ...baseProps, status: "assembling" });
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

  it("renders decorative icons with aria-hidden", () => {
    const html = render({ ...baseProps, status: "processing" });
    expect(html).toContain('aria-hidden="true"');
  });

  it("passes className prop without type cast", () => {
    const html = render({ ...baseProps, className: "custom-class" });
    expect(html).toContain("custom-class");
  });

  it("renders version badge when versionNum > 1", () => {
    const html = render({ ...baseProps, versionNum: 2 });
    expect(html).toContain("v2");
  });

  it("does not render version badge when versionNum is 1", () => {
    const html = render({ ...baseProps, versionNum: 1 });
    expect(html).not.toContain("v1");
  });

  it("does not render version badge when versionNum is undefined", () => {
    const html = render(baseProps);
    expect(html).not.toMatch(/v\d+/);
  });

  it("renders image with cursor-pointer for lightbox", () => {
    const html = render(baseProps);
    expect(html).toContain("cursor-pointer");
  });

  it("PDF View button is a <button> not <a>", () => {
    const html = render({
      ...baseProps,
      filename: "report.pdf",
      mimeType: "application/pdf",
    });
    expect(html).toContain("<button");
    expect(html).toContain("View PDF");
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
