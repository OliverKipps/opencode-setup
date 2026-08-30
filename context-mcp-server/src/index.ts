#!/usr/bin/env node

/**
 * CONTEXT MCP Server — Entry Point
 *
 * Starts the MCP server with stdio, SSE, or dual transport.
 *
 * Environment variables:
 *   CONTEXT_DIR            — Override context directory path (default: %USERPROFILE%\.context\)
 *   CONTEXT_MAX_FILE_SIZE  — Max file size in bytes (default: 1048576 / 1MB)
 *   CONTEXT_VERSION_CACHE  — Number of versions to keep in memory (default: 5)
 *   CONTEXT_MODE           — Server mode: stdio | sse | dual (default: stdio)
 *   CONTEXT_PORT           — SSE/HTTP server port (default: 3100)
 */

import { config, type ServerMode } from "./config.js";
import { createServer } from "./server/mcp-server.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { startSSEServer } from "./server/sse-transport.js";
import { closeWatcher } from "./fs/watch.js";
import { isContextDirInitialized } from "./fs/context-dir.js";
import { initContextDir } from "./fs/context-dir.js";
import { sessionRegistry } from "./server/session-registry.js";

async function main(): Promise<void> {
  try {
    // Initialize context directory if needed
    if (!isContextDirInitialized()) {
      const result = await initContextDir();
      console.error(`[context-mcp-server] Context directory initialized at: ${result.directory}`);
      console.error(`[context-mcp-server] Created: ${result.created.join(", ") || "none"}`);
    }

    const mode: ServerMode = config.mode;
    const server = await createServer(mode);

    // Start stdio transport
    if (mode === "stdio" || mode === "dual") {
      const transport = new StdioServerTransport();
      console.error(`[context-mcp-server] Starting server with stdio transport (mode: ${mode})...`);
      await server.connect(transport);
      console.error("[context-mcp-server] Server running. Listening on stdin/stdout.");
    }

    // Start SSE transport
    if (mode === "sse" || mode === "dual") {
      console.error(`[context-mcp-server] Starting SSE/HTTP transport on port ${config.port}...`);
      startSSEServer(server);
    }
  } catch (err: any) {
    console.error(`[context-mcp-server] Fatal error: ${err.message}`);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.error("[context-mcp-server] Received SIGINT. Shutting down...");
  await cleanupAndExit();
});

process.on("SIGTERM", async () => {
  console.error("[context-mcp-server] Received SIGTERM. Shutting down...");
  await cleanupAndExit();
});

async function cleanupAndExit(): Promise<void> {
  try {
    // Clean up session registry
    sessionRegistry.cleanupStale(0); // Remove all sessions

    // Close file watcher
    await closeWatcher();
  } catch (err) {
    console.error("[context-mcp-server] Error during cleanup:", err);
  }
  process.exit(0);
}

process.on("uncaughtException", (err) => {
  console.error("[context-mcp-server] Uncaught exception:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[context-mcp-server] Unhandled rejection:", reason);
});

main();
