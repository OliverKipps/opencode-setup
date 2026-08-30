import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { writeFile } from "../fs/file-ops.js";

/**
 * Register the context_write tool.
 * Creates a new context file or overwrites an existing one with version check.
 */
export function registerContextWrite(server: McpServer): void {
  server.tool(
    "context_write",
    "Create a new context file. Fails if the file already exists unless overwrite=true is specified.",
    {
      filename: z.string().describe("Filename to create (e.g., 'new-file.md')"),
      content: z.string().describe("Full markdown content including optional YAML frontmatter"),
      overwrite: z.boolean().optional().default(false).describe("Allow overwriting an existing file"),
      version: z.number().optional().describe("Required if overwrite=true — must match current version"),
    },
    async ({ filename, content, overwrite, version }) => {
      try {
        const result = await writeFile(filename, content, overwrite, version);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: result.success,
                  version: result.version,
                  path: result.path,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: err.message || "INTERNAL_ERROR: Unexpected error writing file" }],
          isError: true,
        };
      }
    }
  );
}
