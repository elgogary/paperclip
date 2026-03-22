/**
 * Task/issue tools — create, list, comment, update, delegate.
 */
import { z } from "zod";
import { api, API_URL, COMPANY_ID } from "./api-client.js";

export function registerTaskTools(server) {
  server.tool(
    "create_task",
    "Create an issue/task and assign it to an agent",
    {
      title: z.string().describe("Task title"),
      body: z.string().optional().describe("Task description (markdown)"),
      agentId: z.string().describe("Agent UUID to assign to"),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    },
    async ({ title, body, agentId, priority }) => {
      const projects = await api(`/companies/${COMPANY_ID}/projects`);
      const projectId = projects[0]?.id;
      if (!projectId) throw new Error("No project found in company");
      const issue = await api(`/companies/${COMPANY_ID}/issues`, {
        method: "POST",
        body: JSON.stringify({
          title, body: body || "", assigneeAgentId: agentId, projectId,
          priority: priority || "medium",
        }),
      });
      return {
        content: [{
          type: "text",
          text: `Task created: ${issue.issueNumber || issue.id}\nTitle: ${title}\nAssigned to: ${agentId}\nURL: ${API_URL}/OPT/issues/${issue.id}`,
        }],
      };
    },
  );

  server.tool(
    "list_tasks",
    "List tasks assigned to an agent",
    {
      agentId: z.string().describe("Agent UUID"),
      status: z.string().optional().describe("Filter: todo,in_progress,done,blocked (default: todo,in_progress)"),
    },
    async ({ agentId, status }) => {
      const s = status || "todo,in_progress";
      const issues = await api(
        `/companies/${COMPANY_ID}/issues?assigneeAgentId=${agentId}&status=${s}`,
      );
      const summary = issues.map((i) => ({
        id: i.id, number: i.issueNumber, title: i.title,
        status: i.status, priority: i.priority, createdAt: i.createdAt,
      }));
      return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
    },
  );

  server.tool(
    "read_task_comments",
    "Read comments on a task — see agent replies and board instructions",
    { issueId: z.string().describe("Issue/task UUID") },
    async ({ issueId }) => {
      const comments = await api(`/issues/${issueId}/comments`);
      const formatted = comments.map((c) => ({
        id: c.id,
        author: c.authorAgentId ? `agent:${c.authorAgentId}` : `user:${c.authorUserId}`,
        body: c.body, createdAt: c.createdAt,
      }));
      return { content: [{ type: "text", text: JSON.stringify(formatted, null, 2) }] };
    },
  );

  server.tool(
    "comment_on_task",
    "Post a comment on a task — agents read these as board instructions",
    {
      issueId: z.string().describe("Issue/task UUID"),
      body: z.string().describe("Comment body (markdown)"),
    },
    async ({ issueId, body }) => {
      const comment = await api(`/issues/${issueId}/comments`, {
        method: "POST", body: JSON.stringify({ body }),
      });
      return { content: [{ type: "text", text: `Comment posted: ${comment.id}` }] };
    },
  );

  server.tool(
    "get_task_detail",
    "Get full details of a task including body, status, assignee",
    { issueId: z.string().describe("Issue/task UUID") },
    async ({ issueId }) => {
      const issue = await api(`/issues/${issueId}`);
      return { content: [{ type: "text", text: JSON.stringify(issue, null, 2) }] };
    },
  );

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
        method: "PATCH", body: JSON.stringify(updates),
      });
      return {
        content: [{ type: "text", text: `Task updated: ${issue.issueNumber || issue.id} → ${JSON.stringify(updates)}` }],
      };
    },
  );

  server.tool(
    "delegate_to_agent",
    "All-in-one: create a task with context from our conversation, assign to agent, and wake them up",
    {
      agentId: z.string().describe("Agent UUID or urlKey"),
      title: z.string().describe("Short task title"),
      context: z.string().describe("Full context — what was discussed, decisions made, what needs to happen"),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    },
    async ({ agentId, title, context, priority }) => {
      let resolvedAgentId = agentId;
      if (!agentId.includes("-")) {
        const agent = await api(`/agents/${agentId}?companyId=${COMPANY_ID}`);
        resolvedAgentId = agent.id;
      }
      const projects = await api(`/companies/${COMPANY_ID}/projects`);
      const projectId = projects[0]?.id;
      if (!projectId) throw new Error("No project found");

      const body = `## Board Instructions\n\n${context}\n\n---\n*Delegated from Claude Code session*`;
      const issue = await api(`/companies/${COMPANY_ID}/issues`, {
        method: "POST",
        body: JSON.stringify({
          title, body, assigneeAgentId: resolvedAgentId, projectId,
          priority: priority || "medium",
        }),
      });

      let wakeResult = "not woken";
      try {
        await api(`/agents/${resolvedAgentId}/wakeup`, {
          method: "POST", body: JSON.stringify({ message: `New task: ${title}` }),
        });
        wakeResult = "woken up";
      } catch (e) {
        wakeResult = `wake failed: ${e.message}`;
      }

      return {
        content: [{
          type: "text",
          text: `Delegated to agent ${resolvedAgentId}:\n- Task: ${issue.issueNumber || issue.id} — ${title}\n- Agent: ${wakeResult}\n- URL: ${API_URL}/OPT/issues/${issue.id}`,
        }],
      };
    },
  );
}
