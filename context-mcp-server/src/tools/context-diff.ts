import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { computeDiff, ensureCurrentVersionCached } from "../fs/diff.js";
import { readFile } from "../fs/file-ops.js";

/**
 * Register the context_diff tool.
 * Show line-by-line diff between file versions.
 */
export function registerContextDiff(server: McpServer): void {
  server.tool(
    "context_diff",
    "Show line-by-line diff between file versions. Defaults to comparing current with previous version.",
    {
      filename: z.string().describe("File to diff"),
      version_a: z.number().optional().describe("First version to compare (defaults to current-1)"),
      version_b: z.number().optional().describe("Second version to compare (defaults to current)"),
    },
    async ({ filename, version_a, version_b }) => {
      try {
        // Check file exists
        const fileInfo = await readFile(filename);
        if (!fileInfo.exists) {
          return {
            content: [{ type: "text", text: `FILE_NOT_FOUND: File '${filename}' does not exist` }],
            isError: true,
          };
        }

        // Ensure current version is cached for diff comparison
        await ensureCurrentVersionCached(filename);

        const result = await computeDiff(filename, version_a, version_b);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  filename: result.filename,
                  version_a: result.version_a,
                  version_b: result.version_b,
                  diff: result.diff,
                  summary: result.summary,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: err.message || "INTERNAL_ERROR: Unexpected error computing diff" }],
          isError: true,
        };
      }
    }
  );
}
