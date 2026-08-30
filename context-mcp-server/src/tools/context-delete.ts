import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { deleteFile } from "../fs/file-ops.js";

/**
 * Register the context_delete tool.
 * Mov a context file to trash (default) or permanently deletes it.
 * Requires confirmation (confirm=true).
 */
export function registerContextDelete(server: McpServer): void {
  server.tool(
    "context_delete",
    "Move a context file to trash. Requires confirmation flag. Use permanent=true for permanent deletion.",
    {
      filename: z.string().describe("File to delete"),
      confirm: z.boolean().describe("Must be true to confirm deletion"),
      permanent: z.boolean().optional().default(false).describe("Permanently delete instead of moving to trash"),
    },
    async ({ filename, confirm, permanent }) => {
      try {
        const result = await deleteFile(filename, confirm, permanent);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: result.success,
                  trashed_to: result.trashed_to,
                  permanent: result.permanent,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: err.message || "INTERNAL_ERROR: Unexpected error deleting file" }],
          isError: true,
        };
      }
    }
  );
}
