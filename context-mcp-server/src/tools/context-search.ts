import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchFiles } from "../fs/search.js";

/**
 * Register the context_search tool.
 * Full-text search across all context files.
 */
export function registerContextSearch(server: McpServer): void {
  server.tool(
    "context_search",
    "Full-text search across all context files. Searches markdown body only (not frontmatter).",
    {
      query: z.string().describe("Search term or regex pattern"),
      case_sensitive: z.boolean().optional().default(false).describe("Case-sensitive search"),
      regex: z.boolean().optional().default(false).describe("Treat query as a regex pattern"),
      max_results: z.number().optional().default(20).describe("Maximum number of results to return"),
      filename_filter: z.string().optional().describe("Glob pattern to narrow search scope (e.g., 'projects/*.md')"),
    },
    async ({ query, case_sensitive, regex, max_results, filename_filter }) => {
      try {
        const result = await searchFiles({
          query,
          case_sensitive,
          regex,
          max_results,
          filename_filter,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  results: result.results,
                  total_matches: result.total_matches,
                  query: result.query,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: err.message || "INTERNAL_ERROR: Unexpected error searching files" }],
          isError: true,
        };
      }
    }
  );
}
