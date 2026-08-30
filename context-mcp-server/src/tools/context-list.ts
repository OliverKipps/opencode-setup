import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { listFiles } from "../fs/file-ops.js";

/**
 * Register the context_list tool.
 * Lists all context files with metadata, with optional filtering.
 */
export function registerContextList(server: McpServer): void {
  server.tool(
    "context_list",
    "List all context files in the directory with metadata. Optionally filter by tag, importance, or pattern.",
    {
      tag: z.string().optional().describe("Filter by tag"),
      importance: z
        .enum(["critical", "high", "medium", "low", "archived"])
        .optional()
        .describe("Filter by importance level"),
      pattern: z.string().optional().describe("Glob pattern filter (e.g., 'projects/*.md')"),
      include_body: z
        .boolean()
        .optional()
        .default(false)
        .describe("Include first 200 chars of body in results"),
    },
    async ({ tag, importance, pattern, include_body }) => {
      try {
        const result = await listFiles(tag, importance, pattern, include_body);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  files: result.files,
                  total: result.total,
                  directory: result.directory,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: err.message || "INTERNAL_ERROR: Unexpected error listing files" }],
          isError: true,
        };
      }
    }
  );
}
