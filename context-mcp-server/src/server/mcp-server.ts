import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerContextRead } from "../tools/context-read.js";
import { registerContextWrite } from "../tools/context-write.js";
import { registerContextEdit } from "../tools/context-edit.js";
import { registerContextList } from "../tools/context-list.js";
import { registerContextDelete } from "../tools/context-delete.js";
import { registerContextSearch } from "../tools/context-search.js";
import { registerContextDiff } from "../tools/context-diff.js";
import { registerContextWatch } from "../tools/context-watch.js";
import { registerContextAppendJournal } from "../tools/context-append-journal.js";
import { registerContextSuggestPrune } from "../tools/context-suggest-prune.js";
import { registerContextResources } from "../resources/context-resources.js";
import { initContextDir, isContextDirInitialized } from "../fs/context-dir.js";
import type { ServerMode } from "../config.js";

/**
 * Create and configure the MCP server with all tool handlers and resources.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: "context-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  // Register Phase 1 tool handlers
  registerContextRead(server);
  registerContextWrite(server);
  registerContextEdit(server);
  registerContextList(server);
  registerContextDelete(server);

  // Register Phase 2 tool handlers
  registerContextSearch(server);
  registerContextDiff(server);
  registerContextWatch(server);
  registerContextAppendJournal(server);

  // Register Phase 3 tool handlers
  registerContextSuggestPrune(server);

  // Register resources
  registerContextResources(server);

  return server;
}

/**
 * Create a server configured for the given mode.
 */
export async function createServer(mode: ServerMode): Promise<McpServer> {
  const server = createMcpServer();

  // Auto-initialize context directory if it doesn't exist
  if (!isContextDirInitialized()) {
    const result = await initContextDir();
    console.error(`[context-mcp-server] Context directory initialized at: ${result.directory}`);
    console.error(`[context-mcp-server] Created: ${result.created.join(", ") || "none"}`);
  }

  return server;
}

/**
 * Start the server with stdio transport.
 */
export async function startStdioServer(): Promise<void> {
  const server = createMcpServer();

  // Auto-initialize context directory if it doesn't exist
  if (!isContextDirInitialized()) {
    const result = await initContextDir();
    console.error(`[context-mcp-server] Context directory initialized at: ${result.directory}`);
    console.error(`[context-mcp-server] Created: ${result.created.join(", ") || "none"}`);
  }

  const transport = new StdioServerTransport();

  console.error("[context-mcp-server] Starting server with stdio transport...");
  await server.connect(transport);
  console.error("[context-mcp-server] Server running. Listening on stdin/stdout.");
}
