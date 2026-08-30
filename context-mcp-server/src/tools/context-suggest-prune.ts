import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { suggestPrune } from "../pruning/prune.js";

/**
 * Register the context_suggest_prune tool.
 * Flags a context file or section as potentially stale.
 */
export function registerContextSuggestPrune(server: McpServer): void {
  server.tool(
    "context_suggest_prune",
    "Flag a context file or section as potentially stale. Records the suggestion in feedback.md and updates the file's frontmatter.",
    {
      filename: z.string().describe("File that may be stale (e.g., 'old-project.md')"),
      reason: z.string().describe("Why this is stale or should be pruned"),
      section: z
        .string()
        .optional()
        .describe("Specific H2 section that is stale (e.g., 'Active Projects')"),
      suggested_action: z
        .enum(["review", "rewrite", "delete", "archive"])
        .optional()
        .default("review")
        .describe("Suggested action for the user"),
      importance: z
        .enum(["critical", "high", "medium", "low"])
        .optional()
        .default("low")
        .describe("Urgency of the suggestion"),
    },
    async ({ filename, reason, section, suggested_action, importance }) => {
      try {
        const result = await suggestPrune({
          filename,
          reason,
          section,
          suggested_action,
          importance,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: result.success,
                  feedback_entry_id: result.feedback_entry_id,
                  file_flagged: result.file_flagged,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: err.message || "INTERNAL_ERROR: Unexpected error suggesting prune" }],
          isError: true,
        };
      }
    }
  );
}
