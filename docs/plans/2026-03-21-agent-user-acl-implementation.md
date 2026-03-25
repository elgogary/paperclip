# Per-Agent User ACL Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restrict which users can see and chat with which agents, via an admin-managed whitelist on the Agent Detail page.

**Architecture:** New `agent_user_access` table (Drizzle + Postgres). Service layer for CRUD. Filter injected into existing agent list endpoint. New "Access" tab on Agent Detail page.

**Tech Stack:** Drizzle ORM, Express, React, @tanstack/react-query, Sanad AI EOI UI components (PageTabBar, Tabs).

---

### Task 1: Drizzle Schema

**Files:**
- Create: `packages/db/src/schema/agent_user_access.ts`
- Modify: `packages/db/src/schema/index.ts`

**Step 1: Create schema file**

```typescript
import { pgTable, uuid, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { companies } from "./companies.js";

export const agentUserAccess = pgTable(
  "agent_user_access",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    grantedBy: text("granted_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    agentUserUniqueIdx: uniqueIndex("agent_user_access_agent_user_unique_idx").on(
      table.agentId,
      table.userId,
    ),
    companyIdx: index("agent_user_access_company_idx").on(table.companyId),
    userIdx: index("agent_user_access_user_idx").on(table.userId),
  }),
);
```

**Step 2: Add export to barrel**

Add to `packages/db/src/schema/index.ts`:
```typescript
export { agentUserAccess } from "./agent_user_access.js";
```

**Step 3: Generate migration**

```bash
cd packages/db && npx drizzle-kit generate
```

This creates a new `0028_*.sql` migration file automatically.

**Step 4: Commit**

```bash
git add packages/db/src/schema/agent_user_access.ts packages/db/src/schema/index.ts packages/db/src/migrations/
git commit -m "feat(db): add agent_user_access schema and migration"
```

---

### Task 2: Shared Types

**Files:**
- Create: `packages/shared/src/types/agent-access.ts`
- Modify: `packages/shared/src/types/index.ts`

**Step 1: Create type file**

```typescript
export interface AgentUserAccess {
  id: string;
  companyId: string;
  agentId: string;
  userId: string;
  grantedBy: string | null;
  createdAt: Date;
}
```

**Step 2: Add export to barrel**

Add to `packages/shared/src/types/index.ts`:
```typescript
export type { AgentUserAccess } from "./agent-access.js";
```

**Step 3: Commit**

```bash
git add packages/shared/src/types/agent-access.ts packages/shared/src/types/index.ts
git commit -m "feat(shared): add AgentUserAccess type"
```

---

### Task 3: Service Layer

**Files:**
- Create: `server/src/services/agent-access.ts`
- Modify: `server/src/services/index.ts`

**Step 1: Create service**

```typescript
import { and, eq } from "drizzle-orm";
import type { Db } from "@sanadai/db";
import { agentUserAccess } from "@sanadai/db";

export function agentAccessService(db: Db) {
  return {
    listByCompany: (companyId: string) =>
      db.select().from(agentUserAccess).where(eq(agentUserAccess.companyId, companyId)),

    listByAgent: (agentId: string) =>
      db.select().from(agentUserAccess).where(eq(agentUserAccess.agentId, agentId)),

    listByUser: (companyId: string, userId: string) =>
      db.select().from(agentUserAccess).where(
        and(eq(agentUserAccess.companyId, companyId), eq(agentUserAccess.userId, userId)),
      ),

    grant: (data: { companyId: string; agentId: string; userId: string; grantedBy: string | null }) =>
      db.insert(agentUserAccess)
        .values(data)
        .onConflictDoNothing({ target: [agentUserAccess.agentId, agentUserAccess.userId] })
        .returning()
        .then((rows) => rows[0] ?? null),

    revoke: (id: string) =>
      db.delete(agentUserAccess)
        .where(eq(agentUserAccess.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    revokeByAgentAndUser: (agentId: string, userId: string) =>
      db.delete(agentUserAccess)
        .where(and(eq(agentUserAccess.agentId, agentId), eq(agentUserAccess.userId, userId)))
        .returning()
        .then((rows) => rows[0] ?? null),
  };
}
```

**Step 2: Add export to services barrel**

Add to `server/src/services/index.ts`:
```typescript
export { agentAccessService } from "./agent-access.js";
```

**Step 3: Commit**

```bash
git add server/src/services/agent-access.ts server/src/services/index.ts
git commit -m "feat(server): add agent-access service for ACL CRUD"
```

---

### Task 4: API Routes

**Files:**
- Create: `server/src/routes/agent-access.ts`
- Modify: `server/src/routes/index.ts`
- Modify: `server/src/app.ts`

**Step 1: Create routes**

```typescript
import { Router } from "express";
import type { Db } from "@sanadai/db";
import { agentAccessService } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function agentAccessRoutes(db: Db) {
  const router = Router();
  const svc = agentAccessService(db);

  // List all grants for a company
  router.get("/companies/:companyId/agent-access", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const result = await svc.listByCompany(companyId);
    res.json(result);
  });

  // List grants for a specific agent
  router.get("/agents/:agentId/access", async (req, res) => {
    const agentId = req.params.agentId as string;
    // Resolve company from agent to check access
    const grants = await svc.listByAgent(agentId);
    res.json(grants);
  });

  // Grant user access to an agent
  router.post("/companies/:companyId/agent-access", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const { agentId, userId } = req.body as { agentId: string; userId: string };
    if (!agentId || !userId) {
      res.status(422).json({ error: "agentId and userId are required" });
      return;
    }

    const actor = getActorInfo(req);
    const grant = await svc.grant({
      companyId,
      agentId,
      userId,
      grantedBy: actor.actorId,
    });

    if (!grant) {
      res.status(200).json({ status: "already_granted" });
      return;
    }

    res.status(201).json(grant);
  });

  // Revoke access by grant ID
  router.delete("/agent-access/:grantId", async (req, res) => {
    const grantId = req.params.grantId as string;
    const deleted = await svc.revoke(grantId);
    if (!deleted) {
      res.status(404).json({ error: "Grant not found" });
      return;
    }
    res.json(deleted);
  });

  return router;
}
```

**Step 2: Add export to routes barrel**

Add to `server/src/routes/index.ts`:
```typescript
export { agentAccessRoutes } from "./agent-access.js";
```

**Step 3: Mount in app.ts**

Add after the existing `api.use(agentRoutes(db));` line in `server/src/app.ts`:
```typescript
api.use(agentAccessRoutes(db));
```

Import at top of app.ts:
```typescript
import { agentAccessRoutes } from "./routes/index.js";
```

**Step 4: Commit**

```bash
git add server/src/routes/agent-access.ts server/src/routes/index.ts server/src/app.ts
git commit -m "feat(server): add agent-access API routes (CRUD)"
```

---

### Task 5: Filter Agent List by ACL

**Files:**
- Modify: `server/src/routes/agents.ts`

**Step 1: Import the service**

Add import at top of `server/src/routes/agents.ts`:
```typescript
import { agentAccessService } from "../services/index.js";
```

**Step 2: Modify the list endpoint**

Find the handler for `GET /companies/:companyId/agents` (around line 462). Add ACL filtering after the existing `svc.list(companyId)` call:

```typescript
router.get("/companies/:companyId/agents", async (req, res) => {
  const companyId = req.params.companyId as string;
  assertCompanyAccess(req, companyId);
  let result = await svc.list(companyId);

  // Per-agent ACL filtering for non-admin board users
  if (req.actor.type === "board" && !req.actor.isInstanceAdmin) {
    const accessSvc = agentAccessService(db);
    const grants = await accessSvc.listByUser(companyId, req.actor.userId!);
    if (grants.length > 0) {
      const allowedIds = new Set(grants.map((g) => g.agentId));
      result = result.filter((agent) => allowedIds.has(agent.id));
    }
    // If no grants exist for this user, show all agents (backwards-compatible)
  }

  const canReadConfigs = await actorCanReadConfigurationsForCompany(req, companyId);
  if (canReadConfigs || req.actor.type === "board") {
    res.json(result);
    return;
  }
  res.json(result.map((agent) => redactForRestrictedAgentView(agent)));
});
```

**Step 3: Commit**

```bash
git add server/src/routes/agents.ts
git commit -m "feat(server): filter agent list by user ACL grants"
```

---

### Task 6: UI API Client

**Files:**
- Create: `ui/src/api/agentAccess.ts`
- Modify: `ui/src/api/index.ts`

**Step 1: Create API client**

```typescript
import type { AgentUserAccess } from "@sanadai/shared";
import { api } from "./client";

export const agentAccessApi = {
  listByCompany: (companyId: string) =>
    api.get<AgentUserAccess[]>(`/companies/${companyId}/agent-access`),

  listByAgent: (agentId: string) =>
    api.get<AgentUserAccess[]>(`/agents/${agentId}/access`),

  grant: (companyId: string, agentId: string, userId: string) =>
    api.post<AgentUserAccess>(`/companies/${companyId}/agent-access`, { agentId, userId }),

  revoke: (grantId: string) =>
    api.delete<AgentUserAccess>(`/agent-access/${grantId}`),
};
```

**Step 2: Add export to barrel**

Add to `ui/src/api/index.ts`:
```typescript
export { agentAccessApi } from "./agentAccess";
```

**Step 3: Commit**

```bash
git add ui/src/api/agentAccess.ts ui/src/api/index.ts
git commit -m "feat(ui): add agentAccess API client"
```

---

### Task 7: Access Tab Component

**Files:**
- Create: `ui/src/components/AgentAccessTab.tsx`

**Step 1: Create the component**

```typescript
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { agentAccessApi } from "../api/agentAccess";
import { accessApi } from "../api/access";
import { Button } from "@/components/ui/button";
import { Plus, X, Shield, AlertTriangle } from "lucide-react";
import { cn } from "../lib/utils";

type AgentAccessTabProps = {
  agentId: string;
  companyId: string;
};

export function AgentAccessTab({ agentId, companyId }: AgentAccessTabProps) {
  const queryClient = useQueryClient();
  const [showAddUser, setShowAddUser] = useState(false);

  const { data: grants = [] } = useQuery({
    queryKey: ["agent-access", agentId],
    queryFn: () => agentAccessApi.listByAgent(agentId),
  });

  const { data: members = [] } = useQuery({
    queryKey: ["company-members", companyId],
    queryFn: () => accessApi.listMembers(companyId),
    enabled: showAddUser,
  });

  const grantAccess = useMutation({
    mutationFn: (userId: string) => agentAccessApi.grant(companyId, agentId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-access", agentId] });
      setShowAddUser(false);
    },
  });

  const revokeAccess = useMutation({
    mutationFn: (grantId: string) => agentAccessApi.revoke(grantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-access", agentId] });
    },
  });

  const grantedUserIds = new Set(grants.map((g) => g.userId));
  const availableMembers = members.filter(
    (m: { principalType: string; principalId: string }) =>
      m.principalType === "user" && !grantedUserIds.has(m.principalId),
  );

  return (
    <div className="space-y-4 p-4 max-w-2xl">
      {/* Info banner */}
      {grants.length === 0 ? (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
          <Shield className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium">No access restrictions</p>
            <p className="text-xs text-muted-foreground mt-1">
              All company members can access this agent. Add users below to
              restrict access to only listed users.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              Restricted access — {grants.length} user{grants.length !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
              Only listed users can see and interact with this agent. Remove all
              users to make it accessible to everyone.
            </p>
          </div>
        </div>
      )}

      {/* Granted users */}
      {grants.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Granted Users
          </h3>
          {grants.map((grant) => (
            <div
              key={grant.id}
              className="flex items-center justify-between p-2.5 rounded-lg border bg-card"
            >
              <div className="text-sm">
                <span className="font-medium">{grant.userId.slice(0, 12)}...</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-destructive hover:text-destructive"
                onClick={() => revokeAccess.mutate(grant.id)}
                disabled={revokeAccess.isPending}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add user */}
      {!showAddUser ? (
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setShowAddUser(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add User
        </Button>
      ) : (
        <div className="space-y-2 border rounded-lg p-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Select user to grant access
          </h4>
          {availableMembers.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No more users available to add.
            </p>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {availableMembers.map((member: { principalId: string; membershipRole: string | null }) => (
                <button
                  key={member.principalId}
                  onClick={() => grantAccess.mutate(member.principalId)}
                  disabled={grantAccess.isPending}
                  className="w-full flex items-center justify-between p-2 rounded-md hover:bg-muted text-xs text-left"
                >
                  <span>{member.principalId.slice(0, 12)}...</span>
                  <span className="text-muted-foreground">{member.membershipRole ?? "member"}</span>
                </button>
              ))}
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={() => setShowAddUser(false)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add ui/src/components/AgentAccessTab.tsx
git commit -m "feat(ui): add AgentAccessTab component for per-agent user ACL"
```

---

### Task 8: Wire Access Tab into AgentDetail

**Files:**
- Modify: `ui/src/pages/AgentDetail.tsx`

**Step 1: Add "access" to the view type**

Change the type:
```typescript
type AgentDetailView = "dashboard" | "configuration" | "runs" | "access";
```

Update the parser:
```typescript
function parseAgentDetailView(value: string | null): AgentDetailView {
  if (value === "configure" || value === "configuration") return "configuration";
  if (value === "runs") return value;
  if (value === "access") return value;
  return "dashboard";
}
```

**Step 2: Add tab to PageTabBar items**

Find the `PageTabBar` `items` array and add:
```typescript
{ value: "access", label: "Access" },
```

**Step 3: Add import**

```typescript
import { AgentAccessTab } from "../components/AgentAccessTab";
```

**Step 4: Render the tab content**

Find where `activeView === "dashboard"` content is rendered. Add a new condition:
```typescript
{activeView === "access" && agent && (
  <AgentAccessTab agentId={agent.id} companyId={companyId} />
)}
```

**Step 5: Commit**

```bash
git add ui/src/pages/AgentDetail.tsx
git commit -m "feat(ui): add Access tab to Agent Detail page"
```

---

### Task 9: Check accessApi.listMembers exists

**Files:**
- Possibly modify: `ui/src/api/access.ts`

**Step 1: Check if `listMembers` exists in the access API**

Read `ui/src/api/access.ts` and check for a method that lists company members. If it doesn't exist, add:

```typescript
listMembers: (companyId: string) =>
  api.get<CompanyMembership[]>(`/companies/${companyId}/memberships`),
```

Also check the server route exists: `GET /companies/:companyId/memberships`. If not, the Access tab will need an alternative data source for the user list.

**Step 2: Commit if changed**

```bash
git add ui/src/api/access.ts
git commit -m "feat(ui): add listMembers to access API client"
```

---

### Task 10: Test end-to-end

**Step 1: Run migration**

```bash
cd packages/db && npx drizzle-kit push
```

**Step 2: Test API endpoints**

```bash
# List grants (should be empty)
curl -s -b /tmp/pc-cookies.txt http://100.109.59.30:3100/api/companies/COMPANY_ID/agent-access

# Grant access
curl -s -b /tmp/pc-cookies.txt -X POST http://100.109.59.30:3100/api/companies/COMPANY_ID/agent-access \
  -H "Content-Type: application/json" -H "Origin: http://100.109.59.30:3100" \
  -d '{"agentId":"AGENT_ID","userId":"USER_ID"}'

# Verify agent list is filtered
curl -s -b /tmp/pc-cookies.txt http://100.109.59.30:3100/api/companies/COMPANY_ID/agents

# Revoke
curl -s -b /tmp/pc-cookies.txt -X DELETE http://100.109.59.30:3100/api/agent-access/GRANT_ID
```

**Step 3: Typecheck**

```bash
cd ui && npx tsc --noEmit
```

**Step 4: Commit any fixes**
