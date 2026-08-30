import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFile } from "../fs/file-ops.js";

/**
 * Register the context_read tool.
 * Reads a context file by filename, returning content, frontmatter, body, and version.
 */
export function registerContextRead(server: McpServer): void {
  server.tool(
    "context_read",
    "Read a context file by filename. Returns the file content, frontmatter metadata, and version.",
    {
      filename: z.string().describe("Filename or relative path (e.g., 'who-i-am.md' or 'projects/notes.md')"),
    },
    async ({ filename }) => {
      try {
        const result = await readFile(filename);

        if (!result.exists) {
          return {
            content: [{ type: "text", text: `FILE_NOT_FOUND: File '${filename}' does not exist` }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  filename,
                  content: result.content,
                  frontmatter: result.frontmatter,
                  body: result.body,
                  version: result.version,
                  exists: result.exists,
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
          content: [{ type: "text", text: err.message || "INTERNAL_ERROR: Unexpected error reading file" }],
          isError: true,
        };
      }
    }
  );
}
