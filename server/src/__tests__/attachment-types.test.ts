import { describe, it, expect } from "vitest";
import {
  parseAllowedTypes,
  matchesContentType,
  DEFAULT_ALLOWED_TYPES,
  isAllowedContentType,
  isVideoType,
  maxBytesForType,
} from "../attachment-types.js";

describe("parseAllowedTypes", () => {
  it("returns default image types when input is undefined", () => {
    expect(parseAllowedTypes(undefined)).toEqual([...DEFAULT_ALLOWED_TYPES]);
  });

  it("returns default image types when input is empty string", () => {
    expect(parseAllowedTypes("")).toEqual([...DEFAULT_ALLOWED_TYPES]);
  });

  it("parses comma-separated types", () => {
    expect(parseAllowedTypes("image/*,application/pdf")).toEqual([
      "image/*",
      "application/pdf",
    ]);
  });

  it("trims whitespace", () => {
    expect(parseAllowedTypes(" image/png , application/pdf ")).toEqual([
      "image/png",
      "application/pdf",
    ]);
  });

  it("lowercases entries", () => {
    expect(parseAllowedTypes("Application/PDF")).toEqual(["application/pdf"]);
  });

  it("filters empty segments", () => {
    expect(parseAllowedTypes("image/png,,application/pdf,")).toEqual([
      "image/png",
      "application/pdf",
    ]);
  });
});

describe("matchesContentType", () => {
  it("matches exact types", () => {
    const patterns = ["application/pdf", "image/png"];
    expect(matchesContentType("application/pdf", patterns)).toBe(true);
    expect(matchesContentType("image/png", patterns)).toBe(true);
    expect(matchesContentType("text/plain", patterns)).toBe(false);
  });

  it("matches /* wildcard patterns", () => {
    const patterns = ["image/*"];
    expect(matchesContentType("image/png", patterns)).toBe(true);
    expect(matchesContentType("image/jpeg", patterns)).toBe(true);
    expect(matchesContentType("image/svg+xml", patterns)).toBe(true);
    expect(matchesContentType("application/pdf", patterns)).toBe(false);
  });

  it("matches .* wildcard patterns", () => {
    const patterns = ["application/vnd.openxmlformats-officedocument.*"];
    expect(
      matchesContentType(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        patterns,
      ),
    ).toBe(true);
    expect(
      matchesContentType(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        patterns,
      ),
    ).toBe(true);
    expect(matchesContentType("application/pdf", patterns)).toBe(false);
  });

  it("is case-insensitive", () => {
    const patterns = ["application/pdf"];
    expect(matchesContentType("APPLICATION/PDF", patterns)).toBe(true);
    expect(matchesContentType("Application/Pdf", patterns)).toBe(true);
  });

  it("combines exact and wildcard patterns", () => {
    const patterns = ["image/*", "application/pdf", "text/*"];
    expect(matchesContentType("image/webp", patterns)).toBe(true);
    expect(matchesContentType("application/pdf", patterns)).toBe(true);
    expect(matchesContentType("text/csv", patterns)).toBe(true);
    expect(matchesContentType("application/zip", patterns)).toBe(false);
  });

  it("handles plain * as allow-all wildcard", () => {
    const patterns = ["*"];
    expect(matchesContentType("image/png", patterns)).toBe(true);
    expect(matchesContentType("application/pdf", patterns)).toBe(true);
    expect(matchesContentType("text/plain", patterns)).toBe(true);
    expect(matchesContentType("application/zip", patterns)).toBe(true);
  });

  it("matches wildcard video/*", () => {
    expect(matchesContentType("video/mp4", ["video/*"])).toBe(true);
  });

  it("matches Office wildcard", () => {
    const type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    expect(matchesContentType(type, ["application/vnd.openxmlformats-officedocument.*"])).toBe(true);
  });

  it("rejects disallowed type", () => {
    expect(matchesContentType("application/x-executable", ["image/*"])).toBe(false);
  });
});

describe("DEFAULT_ALLOWED_TYPES", () => {
  it("includes all image types", () => {
    expect(DEFAULT_ALLOWED_TYPES).toContain("image/png");
    expect(DEFAULT_ALLOWED_TYPES).toContain("image/gif");
  });
  it("includes video types", () => {
    expect(DEFAULT_ALLOWED_TYPES).toContain("video/mp4");
    expect(DEFAULT_ALLOWED_TYPES).toContain("video/webm");
  });
  it("includes Office document types", () => {
    expect(DEFAULT_ALLOWED_TYPES).toContain("application/pdf");
    expect(DEFAULT_ALLOWED_TYPES).toContain("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  });
});

describe("isVideoType", () => {
  it("returns true for video/mp4", () => expect(isVideoType("video/mp4")).toBe(true));
  it("returns true for video/webm", () => expect(isVideoType("video/webm")).toBe(true));
  it("returns false for image/png", () => expect(isVideoType("image/png")).toBe(false));
  it("returns false for application/pdf", () => expect(isVideoType("application/pdf")).toBe(false));
});

describe("maxBytesForType", () => {
  it("returns 2GB for video/mp4", () => expect(maxBytesForType("video/mp4")).toBe(2 * 1024 * 1024 * 1024));
  it("returns 100MB for application/pdf", () => expect(maxBytesForType("application/pdf")).toBe(100 * 1024 * 1024));
  it("returns 100MB for image/png", () => expect(maxBytesForType("image/png")).toBe(100 * 1024 * 1024));
});

describe("isAllowedContentType", () => {
  it("allows image/png by default", () => expect(isAllowedContentType("image/png")).toBe(true));
  it("allows video/mp4 by default", () => expect(isAllowedContentType("video/mp4")).toBe(true));
  it("allows application/pdf by default", () => expect(isAllowedContentType("application/pdf")).toBe(true));
});
