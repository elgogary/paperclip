#!/usr/bin/env node
/**
 * Sanad AI EOI — MCP Server
 * Connects Claude Code to the Sanad AI agent crew.
 *
 * 17 tools across 4 modules:
 *   agent-tools:   list_agents, get_agent_detail, wakeup_agent,
 *                  read_instructions, list_notes, add_note
 *   run-tools:     list_runs, read_run_log, read_run_events
 *   task-tools:    create_task, list_tasks, read_task_comments,
 *                  comment_on_task, get_task_detail, update_task,
 *                  delegate_to_agent
 *   session-tools: search_conversations
 *
 * Config (env vars):
 *   SANAD_API_URL    — Base URL (default: http://100.109.59.30:3100)
 *   SANAD_EMAIL      — Login email
 *   SANAD_PASSWORD   — Login password
 *   SANAD_COMPANY_ID — Company UUID
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAgentTools } from "./tools/agent-tools.js";
import { registerRunTools } from "./tools/run-tools.js";
import { registerTaskTools } from "./tools/task-tools.js";
import { registerSessionTools } from "./tools/session-tools.js";

const server = new McpServer({
  name: "sanad-ai",
  version: "0.2.0",
});

registerAgentTools(server);
registerRunTools(server);
registerTaskTools(server);
registerSessionTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
