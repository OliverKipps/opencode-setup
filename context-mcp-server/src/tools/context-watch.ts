import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { subscribe } from "../fs/watch.js";
import { sessionRegistry } from "../server/session-registry.js";

/**
 * Register the context_watch tool.
 * Subscribe to changes on a context file or the entire directory.
 */
export function registerContextWatch(server: McpServer): void {
  server.tool(
    "context_watch",
    "Subscribe to changes on a context file or the entire directory. When a file changes, a notification is pushed via SSE.",
    {
      filename: z.string().optional().describe("Specific file to watch. Omit to watch entire .context directory."),
      events: z
        .array(z.enum(["change", "add", "unlink"]))
        .optional()
        .default(["change"])
        .describe("Events to subscribe to"),
    },
    async ({ filename, events }, extra) => {
      try {
        // Extract session info from extra
        const sessionId = (extra as any)?.session?.sessionId ?? "unknown";

        // Record the tool call in the session registry
        sessionRegistry.recordToolCall(sessionId, "context_watch");

        const result = await subscribe(filename, events, sessionId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  subscribed: result.subscribed,
                  resource_uri: result.resource_uri,
                  files_watched: result.files_watched,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: err.message || "INTERNAL_ERROR: Unexpected error setting up watch" }],
          isError: true,
        };
      }
    }
  );
}
