import type { Db } from "@paperclipai/db";

interface ErrorEntry {
  count: number;
  firstSeen: Date;
  lastError: string;
}

// In-memory error tracking per tool per company
// TODO: Replace with Redis INCR for production use
const errorCounts = new Map<string, ErrorEntry>();

const THRESHOLD_COUNT = 3;
const THRESHOLD_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function buildKey(companyId: string, toolName: string): string {
  return `${companyId}::${toolName}`;
}

function pruneStaleEntries(): void {
  const now = Date.now();
  for (const [key, entry] of errorCounts) {
    if (now - entry.firstSeen.getTime() > THRESHOLD_WINDOW_MS) {
      errorCounts.delete(key);
    }
  }
}

export function toolDegradationMonitor(_db: Db) {
  return {
    async recordError(toolName: string, errorMessage: string, companyId: string): Promise<void> {
      pruneStaleEntries();

      const key = buildKey(companyId, toolName);
      const existing = errorCounts.get(key);

      if (existing) {
        existing.count += 1;
        existing.lastError = errorMessage;
      } else {
        errorCounts.set(key, {
          count: 1,
          firstSeen: new Date(),
          lastError: errorMessage,
        });
      }
    },

    async checkThresholds(companyId: string): Promise<Array<{ toolName: string; errorCount: number }>> {
      pruneStaleEntries();

      const degraded: Array<{ toolName: string; errorCount: number }> = [];
      const prefix = `${companyId}::`;

      for (const [key, entry] of errorCounts) {
        if (key.startsWith(prefix) && entry.count >= THRESHOLD_COUNT) {
          const toolName = key.slice(prefix.length);
          degraded.push({ toolName, errorCount: entry.count });
        }
      }

      return degraded;
    },
  };
}

// Exported for testing
export function resetErrorCounts(): void {
  errorCounts.clear();
}
