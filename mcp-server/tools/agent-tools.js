/**
 * Agent management tools — list, detail, wakeup, instructions, notes.
 */
import { z } from "zod";
import { api, COMPANY_ID } from "./api-client.js";

export function registerAgentTools(server) {
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

  server.tool(
    "get_agent_detail",
    "Get full details for a specific agent including capabilities and adapter config",
    { agentId: z.string().describe("Agent UUID or urlKey (e.g. 'ceo', 'techlead')") },
    async ({ agentId }) => {
      const agent = await api(`/agents/${agentId}?companyId=${COMPANY_ID}`);
      return { content: [{ type: "text", text: JSON.stringify(agent, null, 2) }] };
    },
  );

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

  server.tool(
    "read_instructions",
    "Read an agent's SOUL.md instructions file",
    { agentId: z.string().describe("Agent UUID") },
    async ({ agentId }) => {
      const data = await api(`/agents/${agentId}/instructions`);
      if (!data.content) {
        return {
          content: [{
            type: "text",
            text: `No instructions found. Path: ${data.path || "not configured"}. ${data.error || ""}`,
          }],
        };
      }
      return { content: [{ type: "text", text: `# ${data.path}\n\n${data.content}` }] };
    },
  );

  server.tool(
    "list_notes",
    "List board improvement notes for an agent",
    { agentId: z.string().describe("Agent UUID") },
    async ({ agentId }) => {
      const notes = await api(`/agents/${agentId}/notes`);
      return { content: [{ type: "text", text: JSON.stringify(notes, null, 2) }] };
    },
  );

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
      return { content: [{ type: "text", text: `Note added: ${note.id}` }] };
    },
  );
}
