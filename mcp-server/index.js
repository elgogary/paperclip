#!/usr/bin/env node
/**
 * Sanad AI EOI — MCP Server
 * Connects Claude Code to the Sanad AI agent crew.
 *
 * Tools:
 *   list_agents         — List all agents with status, role, budget
 *   get_agent_detail    — Full agent info including capabilities and config
 *   list_runs           — Recent heartbeat runs for an agent
 *   read_run_log        — Full stdout/stderr log from a run
 *   read_run_events     — Structured events (lifecycle, tool calls, etc.)
 *   wakeup_agent        — Trigger an agent's heartbeat
 *   create_task         — Create an issue and assign to an agent
 *   list_tasks          — List tasks assigned to an agent
 *   read_task_comments  — See agent replies on a task
 *   comment_on_task     — Post board instructions on a task
 *   get_task_detail     — Full task info
 *   update_task         — Change status, priority, or assignee
 *   read_instructions   — Read agent's SOUL.md file
 *   list_notes          — List board improvement notes for an agent
 *   add_note            — Add a board improvement note
 *
 * Config (env vars):
 *   SANAD_API_URL      — Base URL (default: http://100.109.59.30:3100)
 *   SANAD_EMAIL        — Login email
 *   SANAD_PASSWORD     — Login password
 *   SANAD_COMPANY_ID   — Company UUID
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_URL = process.env.SANAD_API_URL || "http://100.109.59.30:3100";
const EMAIL = process.env.SANAD_EMAIL || "";
const PASSWORD = process.env.SANAD_PASSWORD || "";
const COMPANY_ID = process.env.SANAD_COMPANY_ID || "";

let sessionCookie = "";

// ── HTTP helpers ──

async function login() {
  if (sessionCookie) return;
  const res = await fetch(`${API_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: API_URL },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookie) {
    if (c.includes("session_token")) {
      sessionCookie = c.split(";")[0];
      break;
    }
  }
  if (!sessionCookie) {
    const text = await res.text();
    throw new Error(`Login failed: ${res.status} ${text.slice(0, 200)}`);
  }
}

async function api(path, opts = {}) {
  await login();
  const res = await fetch(`${API_URL}/api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Origin: API_URL,
      Cookie: sessionCookie,
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${opts.method || "GET"} ${path}: ${res.status} ${text.slice(0, 300)}`);
  }
  return res.json();
}

// ── MCP Server ──

const server = new McpServer({
  name: "sanad-ai",
  version: "0.1.0",
});

// 1. List agents
server.tool(
  "list_agents",
  "List all Sanad AI agents with status, role, budget, and last heartbeat",
  {},
  async () => {
    const agents = await api(`/companies/${COMPANY_ID}/agents`);
    const summary = agents.map((a) => ({
      id: a.id,
      name: a.name,
      role: a.role,
      title: a.title,
      status: a.status,
      icon: a.icon,
      model: a.adapterConfig?.model || "unknown",
      budgetCents: a.budgetMonthlyCents,
      spentCents: a.spentMonthlyCents,
      lastHeartbeat: a.lastHeartbeatAt,
      reportsTo: a.reportsTo,
    }));
    return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
  },
);

// 2. Get agent detail
server.tool(
  "get_agent_detail",
  "Get full details for a specific agent including capabilities and adapter config",
  { agentId: z.string().describe("Agent UUID or urlKey (e.g. 'ceo', 'techlead')") },
  async ({ agentId }) => {
    const agent = await api(`/agents/${agentId}?companyId=${COMPANY_ID}`);
    return { content: [{ type: "text", text: JSON.stringify(agent, null, 2) }] };
  },
);

// 3. List runs
server.tool(
  "list_runs",
  "List recent heartbeat runs for an agent (or all agents if no agentId)",
  {
    agentId: z.string().optional().describe("Agent UUID (omit for all agents)"),
    limit: z.number().optional().describe("Max results (default 10)"),
  },
  async ({ agentId, limit }) => {
    const q = agentId ? `?agentId=${agentId}` : "";
    const runs = await api(`/companies/${COMPANY_ID}/heartbeat-runs${q}`);
    const trimmed = runs.slice(0, limit || 10).map((r) => ({
      id: r.id,
      agentId: r.agentId,
      status: r.status,
      trigger: r.triggerDetail,
      cost: r.usageJson?.costUsd || 0,
      tokens: r.usageJson?.totalTokens || 0,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
    }));
    return { content: [{ type: "text", text: JSON.stringify(trimmed, null, 2) }] };
  },
);

// 4. Read run log
server.tool(
  "read_run_log",
  "Read the full stdout/stderr log from a specific run",
  {
    runId: z.string().describe("Run UUID"),
    offset: z.number().optional().describe("Byte offset to start from (default 0)"),
  },
  async ({ runId, offset }) => {
    const data = await api(
      `/heartbeat-runs/${runId}/log?offset=${offset || 0}&limitBytes=64000`,
    );
    // Parse NDJSON content into readable text
    const content = data.content || "";
    const lines = content
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          const parsed = JSON.parse(line);
          return `[${parsed.stream}] ${parsed.chunk}`;
        } catch {
          return line;
        }
      })
      .join("");
    return {
      content: [{ type: "text", text: lines || "(empty log)" }],
    };
  },
);

// 5. Read run events
server.tool(
  "read_run_events",
  "Read structured events from a run (lifecycle, tool calls, etc.)",
  { runId: z.string().describe("Run UUID") },
  async ({ runId }) => {
    const events = await api(`/heartbeat-runs/${runId}/events?afterSeq=0&limit=200`);
    const summary = events.map((e) => ({
      seq: e.seq,
      type: e.eventType,
      message: e.message,
      payload: e.payload ? JSON.stringify(e.payload).slice(0, 200) : null,
      createdAt: e.createdAt,
    }));
    return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
  },
);

// 6. Wakeup agent
server.tool(
  "wakeup_agent",
  "Trigger an agent's heartbeat — wakes them up to process tasks",
  {
    agentId: z.string().describe("Agent UUID"),
    message: z.string().optional().describe("Optional wake reason message"),
  },
  async ({ agentId, message }) => {
    const body = message ? { message } : {};
    const result = await api(`/agents/${agentId}/wakeup`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return {
      content: [{ type: "text", text: `Agent woken up. Run: ${JSON.stringify(result)}` }],
    };
  },
);

// 7. Create task
server.tool(
  "create_task",
  "Create an issue/task and assign it to an agent",
  {
    title: z.string().describe("Task title"),
    body: z.string().optional().describe("Task description (markdown)"),
    agentId: z.string().describe("Agent UUID to assign to"),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional().describe("Priority level"),
  },
  async ({ title, body, agentId, priority }) => {
    // Get projectId
    const projects = await api(`/companies/${COMPANY_ID}/projects`);
    const projectId = projects[0]?.id;
    if (!projectId) throw new Error("No project found in company");

    const issue = await api(`/companies/${COMPANY_ID}/issues`, {
      method: "POST",
      body: JSON.stringify({
        title,
        body: body || "",
        assigneeAgentId: agentId,
        projectId,
        priority: priority || "medium",
      }),
    });
    return {
      content: [
        {
          type: "text",
          text: `Task created: ${issue.issueNumber || issue.id}\nTitle: ${title}\nAssigned to: ${agentId}\nURL: ${API_URL}/OPT/issues/${issue.id}`,
        },
      ],
    };
  },
);

// 8. List tasks
server.tool(
  "list_tasks",
  "List tasks assigned to an agent",
  {
    agentId: z.string().describe("Agent UUID"),
    status: z
      .string()
      .optional()
      .describe("Filter by status: todo,in_progress,done,blocked (default: todo,in_progress)"),
  },
  async ({ agentId, status }) => {
    const s = status || "todo,in_progress";
    const issues = await api(
      `/companies/${COMPANY_ID}/issues?assigneeAgentId=${agentId}&status=${s}`,
    );
    const summary = issues.map((i) => ({
      id: i.id,
      number: i.issueNumber,
      title: i.title,
      status: i.status,
      priority: i.priority,
      createdAt: i.createdAt,
    }));
    return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
  },
);

// 9. Read task comments (see agent replies)
server.tool(
  "read_task_comments",
  "Read comments on a task — see agent replies and board instructions",
  { issueId: z.string().describe("Issue/task UUID") },
  async ({ issueId }) => {
    const comments = await api(`/issues/${issueId}/comments`);
    const formatted = comments.map((c) => ({
      id: c.id,
      author: c.authorAgentId ? `agent:${c.authorAgentId}` : `user:${c.authorUserId}`,
      body: c.body,
      createdAt: c.createdAt,
    }));
    return { content: [{ type: "text", text: JSON.stringify(formatted, null, 2) }] };
  },
);

// 10. Comment on task (give agent instructions)
server.tool(
  "comment_on_task",
  "Post a comment on a task — agents read these as board instructions",
  {
    issueId: z.string().describe("Issue/task UUID"),
    body: z.string().describe("Comment body (markdown)"),
  },
  async ({ issueId, body }) => {
    const comment = await api(`/issues/${issueId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
    return {
      content: [{ type: "text", text: `Comment posted: ${comment.id}` }],
    };
  },
);

// 11. Get task detail
server.tool(
  "get_task_detail",
  "Get full details of a task including body, status, assignee",
  { issueId: z.string().describe("Issue/task UUID") },
  async ({ issueId }) => {
    const issue = await api(`/issues/${issueId}`);
    return { content: [{ type: "text", text: JSON.stringify(issue, null, 2) }] };
  },
);

// 12. Update task status
server.tool(
  "update_task",
  "Update a task's status, priority, or assignee",
  {
    issueId: z.string().describe("Issue/task UUID"),
    status: z.enum(["todo", "in_progress", "done", "blocked", "cancelled"]).optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    assigneeAgentId: z.string().optional().describe("Reassign to different agent UUID"),
  },
  async ({ issueId, status, priority, assigneeAgentId }) => {
    const updates = {};
    if (status) updates.status = status;
    if (priority) updates.priority = priority;
    if (assigneeAgentId) updates.assigneeAgentId = assigneeAgentId;
    const issue = await api(`/issues/${issueId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
    return {
      content: [{ type: "text", text: `Task updated: ${issue.issueNumber || issue.id} → ${JSON.stringify(updates)}` }],
    };
  },
);

// 13. Read instructions (SOUL.md)
server.tool(
  "read_instructions",
  "Read an agent's SOUL.md instructions file",
  { agentId: z.string().describe("Agent UUID") },
  async ({ agentId }) => {
    const data = await api(`/agents/${agentId}/instructions`);
    if (!data.content) {
      return {
        content: [
          {
            type: "text",
            text: `No instructions found. Path: ${data.path || "not configured"}. ${data.error || ""}`,
          },
        ],
      };
    }
    return {
      content: [
        { type: "text", text: `# ${data.path}\n\n${data.content}` },
      ],
    };
  },
);

// 10. List notes
server.tool(
  "list_notes",
  "List board improvement notes for an agent",
  { agentId: z.string().describe("Agent UUID") },
  async ({ agentId }) => {
    const notes = await api(`/agents/${agentId}/notes`);
    return { content: [{ type: "text", text: JSON.stringify(notes, null, 2) }] };
  },
);

// 11. Add note
server.tool(
  "add_note",
  "Add a board improvement note for an agent (for next improvement cycle)",
  {
    agentId: z.string().describe("Agent UUID"),
    body: z.string().describe("Note content (markdown)"),
  },
  async ({ agentId, body }) => {
    const note = await api(`/agents/${agentId}/notes`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
    return {
      content: [{ type: "text", text: `Note added: ${note.id}` }],
    };
  },
);

// ── Start ──

const transport = new StdioServerTransport();
await server.connect(transport);
