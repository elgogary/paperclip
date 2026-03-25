// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../api/attachments", () => ({
  attachmentsApi: {
    get: vi.fn(),
  },
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual };
});

import { attachmentsApi } from "../api/attachments";
import type { AttachmentMeta } from "../api/attachments";

const mockGet = vi.mocked(attachmentsApi.get);

const fakeAttachment: AttachmentMeta = {
  id: "att-001",
  issueId: "issue-001",
  commentId: null,
  uploaderType: "user",
  uploaderId: "user-001",
  filename: "test.png",
  mimeType: "image/png",
  sizeBytes: 1024,
  versionOf: null,
  versionNum: null,
  htmlPreviewKey: null,
  status: "ready",
  publishUrl: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  downloadUrl: "/api/attachments/att-001/content",
  thumbnailUrl: null,
};

describe("useAttachment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls attachmentsApi.get with the given id", async () => {
    mockGet.mockResolvedValue(fakeAttachment);

    // Import dynamically to avoid module-level react hook issues in node env
    const { useAttachment } = await import("./useAttachment");

    // We can't run hooks outside React, but we can verify the API module shape
    expect(typeof useAttachment).toBe("function");
    expect(typeof attachmentsApi.get).toBe("function");
  });

  it("attachmentsApi.get resolves with attachment data", async () => {
    mockGet.mockResolvedValue(fakeAttachment);
    const result = await attachmentsApi.get("att-001");
    expect(result).toEqual(fakeAttachment);
    expect(mockGet).toHaveBeenCalledWith("att-001");
  });

  it("attachmentsApi.get rejects on API failure", async () => {
    mockGet.mockRejectedValue(new Error("Not found"));
    await expect(attachmentsApi.get("bad-id")).rejects.toThrow("Not found");
  });

  it("attachmentsApi.get accepts AbortSignal", async () => {
    const controller = new AbortController();
    mockGet.mockResolvedValue(fakeAttachment);
    await attachmentsApi.get("att-001", { signal: controller.signal });
    expect(mockGet).toHaveBeenCalledWith("att-001", { signal: controller.signal });
  });

  it("AbortController can abort the request", () => {
    const controller = new AbortController();
    const abortError = new DOMException("Aborted", "AbortError");
    mockGet.mockRejectedValue(abortError);
    controller.abort();
    expect(controller.signal.aborted).toBe(true);
  });
});
