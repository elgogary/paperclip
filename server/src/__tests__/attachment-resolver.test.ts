import { describe, it, expect } from "vitest";
import { parseAttachTokens, replaceAttachTokens } from "../services/attachment-resolver.js";

describe("parseAttachTokens", () => {
  it("parses simple path", () => {
    const tokens = parseAttachTokens("See [[attach:/workspace/docs/report.docx]]");
    expect(tokens).toHaveLength(1);
    expect(tokens[0].path).toBe("/workspace/docs/report.docx");
    expect(tokens[0].title).toBeUndefined();
  });

  it("parses path with title", () => {
    const tokens = parseAttachTokens('[[attach:/workspace/output/demo.mp4 | title="Demo v2"]]');
    expect(tokens[0].title).toBe("Demo v2");
    expect(tokens[0].path).toBe("/workspace/output/demo.mp4");
  });

  it("returns empty array for plain text", () => {
    expect(parseAttachTokens("plain text no attachments")).toEqual([]);
  });

  it("handles multiple tokens", () => {
    const body = "[[attach:/a/b.pdf]] and [[attach:/workspace/c/d.docx]]";
    expect(parseAttachTokens(body)).toHaveLength(2);
  });

  it("captures the raw match string", () => {
    const token = parseAttachTokens("[[attach:/workspace/file.pdf]]")[0];
    expect(token.raw).toBe("[[attach:/workspace/file.pdf]]");
  });

  it("trims whitespace from path", () => {
    const token = parseAttachTokens("[[attach:  /workspace/file.pdf  ]]")[0];
    expect(token.path).toBe("/workspace/file.pdf");
  });

  it("handles path with spaces in filename", () => {
    const token = parseAttachTokens("[[attach:/workspace/my docs/report final.docx]]")[0];
    expect(token.path).toBe("/workspace/my docs/report final.docx");
  });
});

describe("replaceAttachTokens", () => {
  it("replaces token with attachment id marker", () => {
    const result = replaceAttachTokens(
      "See [[attach:/workspace/docs/report.docx]]",
      [{ raw: "[[attach:/workspace/docs/report.docx]]", path: "/workspace/docs/report.docx", attachmentId: "att-123" }],
    );
    expect(result).toBe("See [[attachment:att-123]]");
  });

  it("replaces multiple tokens", () => {
    const result = replaceAttachTokens(
      "[[attach:/a/b.pdf]] and [[attach:/c/d.docx]]",
      [
        { raw: "[[attach:/a/b.pdf]]", path: "/a/b.pdf", attachmentId: "id-1" },
        { raw: "[[attach:/c/d.docx]]", path: "/c/d.docx", attachmentId: "id-2" },
      ],
    );
    expect(result).toBe("[[attachment:id-1]] and [[attachment:id-2]]");
  });

  it("leaves body unchanged when no resolved tokens", () => {
    const body = "just plain text";
    expect(replaceAttachTokens(body, [])).toBe(body);
  });

  it("preserves surrounding text", () => {
    const result = replaceAttachTokens(
      "Before [[attach:/workspace/f.pdf]] middle [[attach:/workspace/g.png]] after",
      [
        { raw: "[[attach:/workspace/f.pdf]]", path: "/workspace/f.pdf", attachmentId: "a1" },
        { raw: "[[attach:/workspace/g.png]]", path: "/workspace/g.png", attachmentId: "a2" },
      ],
    );
    expect(result).toBe("Before [[attachment:a1]] middle [[attachment:a2]] after");
  });
});
