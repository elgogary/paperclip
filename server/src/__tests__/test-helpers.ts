import { vi } from "vitest";

/**
 * Creates a chainable mock DB object that mimics Drizzle ORM's query builder.
 * Terminal methods (limit, returning, orderBy, where) resolve with the given value.
 */
export function createMockDb(resolveValue: unknown = []) {
  const mockDb: Record<string, unknown> = {};
  const chainMethods = [
    "select", "from", "where", "orderBy", "limit",
    "insert", "values", "returning",
    "update", "set",
    "delete",
    "onConflictDoUpdate",
  ];
  for (const method of chainMethods) {
    (mockDb as Record<string, unknown>)[method] = vi.fn().mockReturnValue(mockDb);
  }
  // Terminal methods that resolve
  (mockDb as Record<string, unknown>).limit = vi.fn().mockResolvedValue(resolveValue);
  (mockDb as Record<string, unknown>).returning = vi.fn().mockResolvedValue(resolveValue);
  // orderBy without limit is terminal for some queries (listAccess, listCatalog)
  (mockDb as Record<string, unknown>).orderBy = vi.fn().mockImplementation(() => {
    const result = Object.create(mockDb);
    result.then = (resolve: (v: unknown) => unknown) => Promise.resolve(resolveValue).then(resolve);
    result.catch = (reject: (v: unknown) => unknown) => Promise.resolve(resolveValue).catch(reject);
    return result;
  });
  // where without limit is terminal for delete/update chains
  (mockDb as Record<string, unknown>).where = vi.fn().mockImplementation(() => {
    const result = Object.create(mockDb);
    result.then = (resolve: (v: unknown) => unknown) => Promise.resolve(resolveValue).then(resolve);
    result.catch = (reject: (v: unknown) => unknown) => Promise.resolve(resolveValue).catch(reject);
    return result;
  });
  // transaction passes the mock as tx
  (mockDb as Record<string, unknown>).transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(mockDb));
  // execute for raw SQL queries
  (mockDb as Record<string, unknown>).execute = vi.fn().mockResolvedValue(resolveValue);

  return mockDb;
}
