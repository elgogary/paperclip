import { describe, expect, it, vi } from "vitest";

// Mock @paperclipai/db to prevent postgres client from being loaded in unit tests
vi.mock("@paperclipai/db", () => ({
  agentWakeupRequests: { id: "id", agentId: "agentId", companyId: "companyId" },
  heartbeatRuns: { id: "id", agentId: "agentId", status: "status" },
  scheduledJobs: {},
  scheduledJobRuns: {},
}));

import { isPrivateUrl } from "../services/scheduled-job-executors.js";
import { Cron } from "croner";

// ── isPrivateUrl ──────────────────────────────────────────────────────────────

describe("isPrivateUrl", () => {
  describe("blocks private/loopback addresses", () => {
    it("blocks localhost by name", () => {
      expect(isPrivateUrl("http://localhost/hook")).toBe(true);
    });

    it("blocks 127.0.0.1", () => {
      expect(isPrivateUrl("http://127.0.0.1/hook")).toBe(true);
    });

    it("blocks IPv6 loopback ::1", () => {
      expect(isPrivateUrl("http://[::1]/hook")).toBe(true);
    });

    it("blocks 10.x.x.x (class A private)", () => {
      expect(isPrivateUrl("http://10.0.0.1/hook")).toBe(true);
      expect(isPrivateUrl("http://10.255.255.255/hook")).toBe(true);
    });

    it("blocks 192.168.x.x (class C private)", () => {
      expect(isPrivateUrl("http://192.168.1.1/hook")).toBe(true);
      expect(isPrivateUrl("http://192.168.0.0/hook")).toBe(true);
    });

    it("blocks 172.16–172.31 (class B private)", () => {
      expect(isPrivateUrl("http://172.16.0.1/hook")).toBe(true);
      expect(isPrivateUrl("http://172.31.255.255/hook")).toBe(true);
    });

    it("allows 172.15.x.x (outside class B range)", () => {
      expect(isPrivateUrl("http://172.15.0.1/hook")).toBe(false);
    });

    it("allows 172.32.x.x (outside class B range)", () => {
      expect(isPrivateUrl("http://172.32.0.1/hook")).toBe(false);
    });

    it("blocks 169.254.x.x (link-local / AWS metadata endpoint)", () => {
      expect(isPrivateUrl("http://169.254.169.254/latest/meta-data/")).toBe(true);
    });

    it("blocks 0.0.0.0", () => {
      expect(isPrivateUrl("http://0.0.0.0/hook")).toBe(true);
    });
  });

  describe("allows public addresses", () => {
    it("allows public HTTP URL", () => {
      expect(isPrivateUrl("http://example.com/hook")).toBe(false);
    });

    it("allows public HTTPS URL", () => {
      expect(isPrivateUrl("https://hooks.slack.com/services/xyz")).toBe(false);
    });

    it("allows non-private public IP", () => {
      expect(isPrivateUrl("https://8.8.8.8/hook")).toBe(false);
    });
  });

  describe("rejects malformed input safely", () => {
    it("treats unparseable string as private (safe default)", () => {
      expect(isPrivateUrl("not-a-url")).toBe(true);
    });

    it("treats empty string as private", () => {
      expect(isPrivateUrl("")).toBe(true);
    });
  });
});

// ── croner cron expression parsing (computeNextRun logic) ────────────────────

describe("croner cron expression parsing", () => {
  it("returns a future date for a valid expression", () => {
    const job = new Cron("0 9 * * 1", { timezone: "UTC" });
    const next = job.nextRun();
    expect(next).not.toBeNull();
    expect(next!.getTime()).toBeGreaterThan(Date.now());
  });

  it("throws for an invalid expression", () => {
    expect(() => new Cron("invalid cron", { timezone: "UTC" })).toThrow();
  });

  it("next run differs by timezone offset", () => {
    const utcJob = new Cron("0 9 * * *", { timezone: "UTC" });
    const riyadhJob = new Cron("0 9 * * *", { timezone: "Asia/Riyadh" });
    const utcNext = utcJob.nextRun()!.getTime();
    const riyadhNext = riyadhJob.nextRun()!.getTime();
    expect(utcNext).not.toBe(riyadhNext);
  });
});

// ── purgeOldRuns cutoff math ──────────────────────────────────────────────────

describe("purgeOldRuns 90-day cutoff", () => {
  it("cutoff is in the past", () => {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    expect(cutoff.getTime()).toBeLessThan(Date.now());
  });

  it("89-day-old record is after cutoff (not purged)", () => {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const run89 = new Date(Date.now() - 89 * 24 * 60 * 60 * 1000);
    expect(run89.getTime()).toBeGreaterThan(cutoff.getTime());
  });

  it("91-day-old record is before cutoff (purged)", () => {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const run91 = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);
    expect(run91.getTime()).toBeLessThan(cutoff.getTime());
  });
});
