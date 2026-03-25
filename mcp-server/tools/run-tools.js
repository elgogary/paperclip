/**
 * Run inspection tools — list runs, read logs, read events.
 */
import { z } from "zod";
import { api, COMPANY_ID } from "./api-client.js";

export function registerRunTools(server) {
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
      return { content: [{ type: "text", text: lines || "(empty log)" }] };
    },
  );

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
}
