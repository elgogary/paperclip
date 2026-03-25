/**
 * Claude Code session tools — search past conversations.
 */
import { z } from "zod";

export function registerSessionTools(server) {
  server.tool(
    "search_conversations",
    "Search past Claude Code sessions for messages matching a keyword or topic. Returns matching user/assistant messages with session IDs.",
    {
      query: z.string().describe("Keyword or phrase to search for"),
      maxResults: z.number().optional().describe("Max matching messages (default 20)"),
    },
    async ({ query, maxResults }) => {
      const { readdirSync, readFileSync } = await import("fs");
      const { join } = await import("path");
      const sessionsDir = join(
        process.env.HOME || "/home/eslam",
        ".claude/projects/-home-eslam-data",
      );

      const results = [];
      const limit = maxResults || 20;
      const queryLower = query.toLowerCase();

      let files;
      try {
        files = readdirSync(sessionsDir).filter((f) => f.endsWith(".jsonl"));
      } catch {
        return { content: [{ type: "text", text: "Cannot read sessions directory" }] };
      }

      files.sort().reverse();

      for (const file of files) {
        if (results.length >= limit) break;
        try {
          const lines = readFileSync(join(sessionsDir, file), "utf-8").split("\n");
          for (const line of lines) {
            if (!line) continue;
            const msg = JSON.parse(line);
            if (msg.type !== "user" && msg.type !== "assistant") continue;

            let content = "";
            const raw = msg.message?.content;
            if (typeof raw === "string") {
              content = raw;
            } else if (Array.isArray(raw)) {
              content = raw.filter((b) => b.type === "text").map((b) => b.text).join(" ");
            }

            if (content.toLowerCase().includes(queryLower)) {
              results.push({
                sessionId: file.replace(".jsonl", ""),
                role: msg.type,
                excerpt: content.slice(0, 500),
              });
              if (results.length >= limit) break;
            }
          }
        } catch {
          // skip unreadable
        }
      }

      if (results.length === 0) {
        return { content: [{ type: "text", text: `No messages found matching "${query}"` }] };
      }
      return {
        content: [{
          type: "text",
          text: `Found ${results.length} messages matching "${query}":\n\n${JSON.stringify(results, null, 2)}`,
        }],
      };
    },
  );
}
