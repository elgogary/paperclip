import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fsPromises from "node:fs/promises";
import {
  parseAttachTokens,
  replaceAttachTokens,
  resolveAttachTokens,
  isSafePath,
} from "../services/attachment-resolver.js";

vi.mock("node:fs/promises");
vi.mock("@paperclipai/db", () => ({
  attachments: Symbol("attachments"),
}));

function makeMockStorage() {
  return {
    provider: "local" as const,
    putFile: vi.fn().mockResolvedValue({
      provider: "local",
      objectKey: "comp/issues/iss/agent-attach/2026/01/01/uuid-file.pdf",
      contentType: "application/pdf",
      byteSize: 100,
      sha256: "abc123",
      originalFilename: "report.pdf",
    }),
    getObject: vi.fn(),
    headObject: vi.fn(),
    deleteObject: vi.fn().mockResolvedValue(undefined),
    putRawObject: vi.fn(),
    getRawObject: vi.fn(),
  };
}

function makeMockDb() {
  const returning = vi.fn().mockResolvedValue([{ id: "att-uuid-1" }]);
  const values = vi.fn().mockReturnValue({ returning });
  const insert = vi.fn().mockReturnValue({ values });
  return { insert, _values: values, _returning: returning } as unknown as {
    insert: ReturnType<typeof vi.fn>;
    _values: ReturnType<typeof vi.fn>;
    _returning: ReturnType<typeof vi.fn>;
  };
}

/** Helper: set up fs mocks for a successful file read at `filePath`. */
function mockFsSuccess(filePath: string, content = Buffer.from("content"), size = 100) {
  vi.mocked(fsPromises.realpath).mockResolvedValue(filePath);
  vi.mocked(fsPromises.stat).mockResolvedValue({ size } as any);
  vi.mocked(fsPromises.readFile).mockResolvedValue(content);
}

// Suppress console.warn in tests
vi.spyOn(console, "warn").mockImplementation(() => {});

// Suppress fetch calls to media-worker
vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

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
    const body = "[[attach:/workspace/a.pdf]] and [[attach:/workspace/c/d.docx]]";
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

  it("is safe for concurrent calls (no shared lastIndex)", () => {
    // Call twice rapidly — if regex were shared with g flag, second call could misbehave
    const a = parseAttachTokens("[[attach:/workspace/a.pdf]] [[attach:/workspace/b.pdf]]");
    const b = parseAttachTokens("[[attach:/workspace/c.pdf]]");
    expect(a).toHaveLength(2);
    expect(b).toHaveLength(1);
  });
});

describe("replaceAttachTokens", () => {
  it("replaces token with filename and attachment id", () => {
    const result = replaceAttachTokens(
      "See [[attach:/workspace/docs/report.docx]]",
      [{ raw: "[[attach:/workspace/docs/report.docx]]", path: "/workspace/docs/report.docx", attachmentId: "att-123", filename: "report.docx" }],
    );
    expect(result).toBe("See [report.docx](attachment:att-123)");
  });

  it("replaces multiple tokens", () => {
    const result = replaceAttachTokens(
      "[[attach:/workspace/a/b.pdf]] and [[attach:/workspace/c/d.docx]]",
      [
        { raw: "[[attach:/workspace/a/b.pdf]]", path: "/workspace/a/b.pdf", attachmentId: "id-1", filename: "b.pdf" },
        { raw: "[[attach:/workspace/c/d.docx]]", path: "/workspace/c/d.docx", attachmentId: "id-2", filename: "d.docx" },
      ],
    );
    expect(result).toBe("[b.pdf](attachment:id-1) and [d.docx](attachment:id-2)");
  });

  it("leaves body unchanged when no resolved tokens", () => {
    const body = "just plain text";
    expect(replaceAttachTokens(body, [])).toBe(body);
  });

  it("preserves surrounding text", () => {
    const result = replaceAttachTokens(
      "Before [[attach:/workspace/f.pdf]] middle [[attach:/workspace/g.png]] after",
      [
        { raw: "[[attach:/workspace/f.pdf]]", path: "/workspace/f.pdf", attachmentId: "a1", filename: "f.pdf" },
        { raw: "[[attach:/workspace/g.png]]", path: "/workspace/g.png", attachmentId: "a2", filename: "g.png" },
      ],
    );
    expect(result).toBe("Before [f.pdf](attachment:a1) middle [g.png](attachment:a2) after");
  });

  it("replaces failed tokens with file unavailable marker", () => {
    const result = replaceAttachTokens(
      "See [[attach:/workspace/missing.pdf]]",
      [],
      [{ raw: "[[attach:/workspace/missing.pdf]]", path: "/workspace/missing.pdf", filename: "missing.pdf", reason: "file_not_found" }],
    );
    expect(result).toBe("See [file unavailable: missing.pdf]");
  });

  it("handles mix of resolved and failed tokens", () => {
    const result = replaceAttachTokens(
      "[[attach:/workspace/good.pdf]] then [[attach:/workspace/bad.pdf]]",
      [{ raw: "[[attach:/workspace/good.pdf]]", path: "/workspace/good.pdf", attachmentId: "ok-1", filename: "good.pdf" }],
      [{ raw: "[[attach:/workspace/bad.pdf]]", path: "/workspace/bad.pdf", filename: "bad.pdf", reason: "file_not_found" }],
    );
    expect(result).toBe("[good.pdf](attachment:ok-1) then [file unavailable: bad.pdf]");
  });

  it("does not interpret dollar-sign sequences in replacement", () => {
    const result = replaceAttachTokens(
      "See [[attach:/workspace/file.pdf]]",
      [{ raw: "[[attach:/workspace/file.pdf]]", path: "/workspace/file.pdf", attachmentId: "att-$1-$$-$&", filename: "$1report.pdf" }],
    );
    // Dollar signs must be preserved literally, not interpreted as capture group refs
    expect(result).toBe("See [$1report.pdf](attachment:att-$1-$$-$&)");
  });
});

describe("isSafePath", () => {
  it("accepts path inside workspace", () => {
    expect(isSafePath("/workspace/docs/file.pdf", "/workspace")).toBe(true);
  });

  it("rejects path traversal with ..", () => {
    expect(isSafePath("/workspace/../etc/passwd", "/workspace")).toBe(false);
  });

  it("rejects relative path traversal", () => {
    expect(isSafePath("../../etc/passwd", "/workspace")).toBe(false);
  });

  it("rejects absolute path outside workspace", () => {
    expect(isSafePath("/home/user/secret.txt", "/workspace")).toBe(false);
  });

  it("accepts deeply nested workspace path", () => {
    expect(isSafePath("/workspace/a/b/c/d/file.txt", "/workspace")).toBe(true);
  });

  it("rejects path that starts with workspace prefix but escapes", () => {
    // /workspace-evil should not match /workspace root
    expect(isSafePath("/workspace-evil/file.txt", "/workspace")).toBe(false);
  });
});

describe("resolveAttachTokens", () => {
  let mockStorage: ReturnType<typeof makeMockStorage>;
  let mockDb: ReturnType<typeof makeMockDb>;
  const baseOpts = {
    companyId: "comp-1",
    issueId: "issue-1",
    agentId: "agent-1",
    workspaceRoot: "/workspace",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage = makeMockStorage();
    mockDb = makeMockDb();
  });

  it("resolves a valid workspace path to an attachment record", async () => {
    mockFsSuccess("/workspace/docs/report.pdf");

    const tokens = [{ raw: "[[attach:/workspace/docs/report.pdf]]", path: "/workspace/docs/report.pdf" }];
    const { resolved, failed } = await resolveAttachTokens(tokens, {
      ...baseOpts,
      db: mockDb as any,
      storage: mockStorage as any,
    });

    expect(resolved).toHaveLength(1);
    expect(resolved[0].attachmentId).toBe("att-uuid-1");
    expect(resolved[0].filename).toBe("report.pdf");
    expect(failed).toHaveLength(0);
    expect(mockStorage.putFile).toHaveBeenCalledOnce();
    expect(mockDb.insert).toHaveBeenCalledOnce();
  });

  it("rejects path traversal with ../../etc/passwd", async () => {
    const tokens = [{ raw: "[[attach:../../etc/passwd]]", path: "../../etc/passwd" }];
    const { resolved, failed } = await resolveAttachTokens(tokens, {
      ...baseOpts,
      db: mockDb as any,
      storage: mockStorage as any,
    });

    expect(resolved).toHaveLength(0);
    expect(failed).toHaveLength(1);
    expect(failed[0].reason).toBe("path_outside_workspace");
    expect(mockStorage.putFile).not.toHaveBeenCalled();
  });

  it("rejects path outside workspace root", async () => {
    const tokens = [{ raw: "[[attach:/home/user/secret.txt]]", path: "/home/user/secret.txt" }];
    const { resolved, failed } = await resolveAttachTokens(tokens, {
      ...baseOpts,
      db: mockDb as any,
      storage: mockStorage as any,
    });

    expect(resolved).toHaveLength(0);
    expect(failed).toHaveLength(1);
    expect(failed[0].reason).toBe("path_outside_workspace");
    expect(failed[0].filename).toBe("secret.txt");
  });

  it("handles file not found gracefully", async () => {
    vi.mocked(fsPromises.realpath).mockRejectedValue(new Error("ENOENT: no such file"));

    const tokens = [{ raw: "[[attach:/workspace/missing.pdf]]", path: "/workspace/missing.pdf" }];
    const { resolved, failed } = await resolveAttachTokens(tokens, {
      ...baseOpts,
      db: mockDb as any,
      storage: mockStorage as any,
    });

    expect(resolved).toHaveLength(0);
    expect(failed).toHaveLength(1);
    expect(failed[0].reason).toBe("file_not_found");
    expect(failed[0].filename).toBe("missing.pdf");
  });

  it("handles multiple markers in one comment body", async () => {
    vi.mocked(fsPromises.realpath)
      .mockResolvedValueOnce("/workspace/a.pdf")
      .mockResolvedValueOnce("/workspace/b.pdf");
    vi.mocked(fsPromises.stat)
      .mockResolvedValueOnce({ size: 50 } as any)
      .mockResolvedValueOnce({ size: 50 } as any);
    vi.mocked(fsPromises.readFile)
      .mockResolvedValueOnce(Buffer.from("content"))
      .mockRejectedValueOnce(new Error("ENOENT"));

    mockDb._returning
      .mockResolvedValueOnce([{ id: "att-1" }])
      .mockResolvedValueOnce([{ id: "att-2" }]);

    const tokens = [
      { raw: "[[attach:/workspace/a.pdf]]", path: "/workspace/a.pdf" },
      { raw: "[[attach:/workspace/b.pdf]]", path: "/workspace/b.pdf" },
    ];
    const { resolved, failed } = await resolveAttachTokens(tokens, {
      ...baseOpts,
      db: mockDb as any,
      storage: mockStorage as any,
    });

    expect(resolved).toHaveLength(1);
    expect(resolved[0].attachmentId).toBe("att-1");
    expect(failed).toHaveLength(1);
    expect(failed[0].filename).toBe("b.pdf");
  });

  it("uses title option for filename when provided", async () => {
    mockFsSuccess("/workspace/file.pdf");

    const tokens = [{ raw: '[[attach:/workspace/file.pdf | title="Report"]]', path: "/workspace/file.pdf", title: "Report" }];
    const { resolved } = await resolveAttachTokens(tokens, {
      ...baseOpts,
      db: mockDb as any,
      storage: mockStorage as any,
    });

    expect(resolved).toHaveLength(1);
    expect(resolved[0].filename).toBe("Report");
  });

  it("preserves rest of comment body unchanged (integration)", async () => {
    vi.mocked(fsPromises.realpath)
      .mockResolvedValueOnce("/workspace/good.pdf")
      .mockRejectedValueOnce(new Error("ENOENT"));
    vi.mocked(fsPromises.stat).mockResolvedValueOnce({ size: 50 } as any);
    vi.mocked(fsPromises.readFile).mockResolvedValueOnce(Buffer.from("content"));

    mockDb._returning.mockResolvedValueOnce([{ id: "att-ok" }]);

    const body = "Hello [[attach:/workspace/good.pdf]] world [[attach:/workspace/missing.txt]] end";
    const tokens = parseAttachTokens(body);
    const { resolved, failed } = await resolveAttachTokens(tokens, {
      ...baseOpts,
      db: mockDb as any,
      storage: mockStorage as any,
    });
    const result = replaceAttachTokens(body, resolved, failed);

    expect(result).toBe("Hello [good.pdf](attachment:att-ok) world [file unavailable: missing.txt] end");
  });

  // --- Fix 1: symlink escape ---
  it("rejects symlink that resolves outside workspace", async () => {
    // realpath returns a path outside /workspace — symlink escape
    vi.mocked(fsPromises.realpath).mockResolvedValue("/etc/shadow");

    const tokens = [{ raw: "[[attach:/workspace/sneaky-link]]", path: "/workspace/sneaky-link" }];
    const { resolved, failed } = await resolveAttachTokens(tokens, {
      ...baseOpts,
      db: mockDb as any,
      storage: mockStorage as any,
    });

    expect(resolved).toHaveLength(0);
    expect(failed).toHaveLength(1);
    expect(failed[0].reason).toBe("path_outside_workspace");
    expect(mockStorage.putFile).not.toHaveBeenCalled();
  });

  it("rejects when realpath throws ENOENT (file not found)", async () => {
    vi.mocked(fsPromises.realpath).mockRejectedValue(
      Object.assign(new Error("ENOENT: no such file or directory"), { code: "ENOENT" }),
    );

    const tokens = [{ raw: "[[attach:/workspace/ghost.pdf]]", path: "/workspace/ghost.pdf" }];
    const { resolved, failed } = await resolveAttachTokens(tokens, {
      ...baseOpts,
      db: mockDb as any,
      storage: mockStorage as any,
    });

    expect(resolved).toHaveLength(0);
    expect(failed).toHaveLength(1);
    expect(failed[0].reason).toBe("file_not_found");
  });

  // --- Fix 2: per-token isolation + orphan cleanup ---
  it("continues processing remaining tokens after one fails", async () => {
    // Token 1: DB insert fails after upload
    vi.mocked(fsPromises.realpath)
      .mockResolvedValueOnce("/workspace/a.pdf")
      .mockResolvedValueOnce("/workspace/b.pdf");
    vi.mocked(fsPromises.stat)
      .mockResolvedValueOnce({ size: 50 } as any)
      .mockResolvedValueOnce({ size: 50 } as any);
    vi.mocked(fsPromises.readFile)
      .mockResolvedValueOnce(Buffer.from("a-content"))
      .mockResolvedValueOnce(Buffer.from("b-content"));

    // First token: upload succeeds, DB insert throws
    mockDb._returning
      .mockRejectedValueOnce(new Error("DB connection lost"))
      .mockResolvedValueOnce([{ id: "att-2" }]);

    const tokens = [
      { raw: "[[attach:/workspace/a.pdf]]", path: "/workspace/a.pdf" },
      { raw: "[[attach:/workspace/b.pdf]]", path: "/workspace/b.pdf" },
    ];
    const { resolved, failed } = await resolveAttachTokens(tokens, {
      ...baseOpts,
      db: mockDb as any,
      storage: mockStorage as any,
    });

    // Second token should still succeed
    expect(resolved).toHaveLength(1);
    expect(resolved[0].attachmentId).toBe("att-2");
    expect(failed).toHaveLength(1);
    expect(failed[0].filename).toBe("a.pdf");

    // Orphaned storage object from first token should be cleaned up
    expect(mockStorage.deleteObject).toHaveBeenCalledWith(
      "comp-1",
      "comp/issues/iss/agent-attach/2026/01/01/uuid-file.pdf",
    );
  });

  it("cleans up orphaned storage object when DB insert fails", async () => {
    mockFsSuccess("/workspace/orphan.pdf");
    mockDb._returning.mockRejectedValue(new Error("unique constraint violation"));

    const tokens = [{ raw: "[[attach:/workspace/orphan.pdf]]", path: "/workspace/orphan.pdf" }];
    const { resolved, failed } = await resolveAttachTokens(tokens, {
      ...baseOpts,
      db: mockDb as any,
      storage: mockStorage as any,
    });

    expect(resolved).toHaveLength(0);
    expect(failed).toHaveLength(1);
    expect(mockStorage.deleteObject).toHaveBeenCalledOnce();
  });

  // --- Fix 4: stat before read (MIME rejection) ---
  it("rejects disallowed MIME type without reading file into memory", async () => {
    // .exe is not in the allowed list → maps to application/octet-stream
    vi.mocked(fsPromises.realpath).mockResolvedValue("/workspace/malware.exe");

    const tokens = [{ raw: "[[attach:/workspace/malware.exe]]", path: "/workspace/malware.exe" }];
    const { resolved, failed } = await resolveAttachTokens(tokens, {
      ...baseOpts,
      db: mockDb as any,
      storage: mockStorage as any,
    });

    expect(resolved).toHaveLength(0);
    expect(failed).toHaveLength(1);
    expect(failed[0].reason).toBe("disallowed_content_type");
    // stat and readFile should NOT have been called since MIME check happens first
    expect(fsPromises.stat).not.toHaveBeenCalled();
    expect(fsPromises.readFile).not.toHaveBeenCalled();
  });

  // --- Fix 4: stat before read (size rejection) ---
  it("rejects file exceeding size limit via stat without reading full content", async () => {
    vi.mocked(fsPromises.realpath).mockResolvedValue("/workspace/huge.pdf");
    // 200 MB — over default 100 MB limit
    vi.mocked(fsPromises.stat).mockResolvedValue({ size: 200 * 1024 * 1024 } as any);

    const tokens = [{ raw: "[[attach:/workspace/huge.pdf]]", path: "/workspace/huge.pdf" }];
    const { resolved, failed } = await resolveAttachTokens(tokens, {
      ...baseOpts,
      db: mockDb as any,
      storage: mockStorage as any,
    });

    expect(resolved).toHaveLength(0);
    expect(failed).toHaveLength(1);
    expect(failed[0].reason).toBe("file_too_large");
    // readFile should NOT have been called since stat caught it
    expect(fsPromises.readFile).not.toHaveBeenCalled();
  });

  // --- Fix 6: board-user tokens ---
  it("ignores tokens from board users and returns empty results", async () => {
    const tokens = [{ raw: "[[attach:/workspace/file.pdf]]", path: "/workspace/file.pdf" }];
    const { resolved, failed } = await resolveAttachTokens(tokens, {
      ...baseOpts,
      db: mockDb as any,
      storage: mockStorage as any,
      uploaderType: "user",
    });

    expect(resolved).toHaveLength(0);
    expect(failed).toHaveLength(0);
    expect(mockStorage.putFile).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("board user"),
    );
  });

  it("rejects symlink that escapes workspace root (stat succeeds but realpath outside)", async () => {
    // File exists at /workspace/evil-link but realpath resolves to /etc/passwd
    vi.mocked(fsPromises.realpath).mockResolvedValue("/etc/passwd");
    vi.mocked(fsPromises.stat).mockResolvedValue({ size: 100 } as any);

    const tokens = [{ raw: "[[attach:/workspace/evil-link]]", path: "/workspace/evil-link" }];
    const { resolved, failed } = await resolveAttachTokens(tokens, {
      ...baseOpts,
      db: mockDb as any,
      storage: mockStorage as any,
    });

    expect(resolved).toHaveLength(0);
    expect(failed).toHaveLength(1);
    expect(failed[0].reason).toBe("path_outside_workspace");
    expect(mockStorage.putFile).not.toHaveBeenCalled();
    // stat should NOT have been called — realpath check catches it first
    expect(fsPromises.stat).not.toHaveBeenCalled();
  });

  it("rejects path containing null bytes", async () => {
    const tokens = [{ raw: "[[attach:/workspace/evil\0.pdf]]", path: "/workspace/evil\0.pdf" }];
    const { resolved, failed } = await resolveAttachTokens(tokens, {
      ...baseOpts,
      db: mockDb as any,
      storage: mockStorage as any,
    });

    expect(resolved).toHaveLength(0);
    expect(failed).toHaveLength(1);
    expect(failed[0].reason).toBe("path_outside_workspace");
    expect(mockStorage.putFile).not.toHaveBeenCalled();
  });

  it("processes tokens normally when uploaderType is agent", async () => {
    mockFsSuccess("/workspace/file.pdf");

    const tokens = [{ raw: "[[attach:/workspace/file.pdf]]", path: "/workspace/file.pdf" }];
    const { resolved } = await resolveAttachTokens(tokens, {
      ...baseOpts,
      db: mockDb as any,
      storage: mockStorage as any,
      uploaderType: "agent",
    });

    expect(resolved).toHaveLength(1);
  });
});
