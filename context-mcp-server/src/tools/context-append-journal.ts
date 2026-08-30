import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { appendJournalEntry } from "../journal/journal.js";

/**
 * Register the context_append_journal tool.
 * Append a timestamped entry to journal.md.
 */
export function registerContextAppendJournal(server: McpServer): void {
  server.tool(
    "context_append_journal",
    "Append a timestamped entry to the journal.md file. Each entry records what happened during a session.",
    {
      content: z.string().describe("Markdown content for the journal entry"),
      source: z
        .enum(["opencode", "chatgpt", "claude", "gemini", "manual"])
        .describe("Which AI tool is logging this entry"),
      session_id: z.string().optional().describe("Optional session identifier for grouping entries"),
      files_accessed: z.array(z.string()).optional().describe("List of context files read/written during session"),
    },
    async ({ content, source, session_id, files_accessed }) => {
      try {
        const result = await appendJournalEntry({
          content,
          source,
          session_id,
          files_accessed,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: result.success,
                  entry_id: result.entry_id,
                  timestamp: result.timestamp,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: err.message || "INTERNAL_ERROR: Unexpected error appending journal entry" }],
          isError: true,
        };
      }
    }
  );
}
