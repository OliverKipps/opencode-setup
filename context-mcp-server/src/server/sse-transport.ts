import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { config } from "../config.js";
import { clearSessionSubscriptions } from "../fs/watch.js";
import { sessionRegistry } from "./session-registry.js";

/**
 * Active SSE transports mapped by session ID.
 */
const transports: Record<string, SSEServerTransport> = {};

/**
 * Start the SSE/HTTP transport server on localhost.
 * Follows the official @modelcontextprotocol/sdk pattern for SSE transport.
 * This allows external AI tools (ChatGPT, Claude Desktop via mcp-remote, Gemini) to connect.
 */
export function startSSEServer(mcpServer: McpServer): void {
  // Use the SDK's pre-configured Express app with DNS rebinding protection
  const app = createMcpExpressApp({ host: "127.0.0.1" });

  // GET /sse — establish SSE stream (MCP protocol 2024-11-05)
  // The SSEServerTransport handles sending the 'endpoint' event with session ID
  app.get("/sse", async (req, res) => {
    try {
      // Create SSE transport linked to the POST endpoint
      const transport = new SSEServerTransport("/message", res);
      const sessionId = transport.sessionId;

      // Store for POST handler to find
      transports[sessionId] = transport;

      // Register with session registry
      const session = sessionRegistry.createSession("sse-client");
      // Connect our session registry ID to the transport session ID
      // by recording the file access source
      sessionRegistry.recordFileAccess(session.sessionId, "sse-connect");

      console.error(
        `[context-mcp-server] SSE client connected: ${sessionId} (registry: ${session.sessionId})`
      );

      // Clean up when transport closes
      transport.onclose = () => {
        console.error(`[context-mcp-server] SSE transport closed: ${sessionId}`);
        delete transports[sessionId];
        clearSessionSubscriptions(sessionId);
        sessionRegistry.removeSession(session.sessionId);
      };

      // Connect transport to the MCP server
      // This sends the 'endpoint' event back to the client automatically
      await mcpServer.connect(transport);
    } catch (err: any) {
      console.error(`[context-mcp-server] SSE connection error: ${err.message}`);
      if (!res.headersSent) {
        res.status(500).send("Error establishing SSE stream");
      }
    }
  });

  // POST /message — receive JSON-RPC messages from the client
  // The client sends the sessionId as a query parameter (as instructed by the endpoint event)
  app.post("/message", async (req, res) => {
    const sessionId = req.query.sessionId as string;

    if (!sessionId) {
      res.status(400).json({ error: "Missing sessionId query parameter" });
      return;
    }

    const transport = transports[sessionId];
    if (!transport) {
      res.status(404).json({ error: `No active session found for ID: ${sessionId}` });
      return;
    }

    try {
      // Pass the Express request/response and body to the transport handler
      await transport.handlePostMessage(req, res, req.body);
    } catch (err: any) {
      console.error(`[context-mcp-server] Error handling message: ${err.message}`);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      activeSessions: Object.keys(transports).length,
      mode: "sse",
      port: config.port,
    });
  });

  // Bind to localhost only
  const host = "127.0.0.1";
  const port = config.port;

  const server = app.listen(port, host, () => {
    console.error(`[context-mcp-server] SSE/HTTP server listening on http://${host}:${port}`);
    console.error(`[context-mcp-server]   SSE endpoint: GET  http://localhost:${port}/sse`);
    console.error(`[context-mcp-server]   Message endpoint: POST http://localhost:${port}/message?sessionId=<id>`);
    console.error(`[context-mcp-server]   Health check: GET  http://localhost:${port}/health`);
  });

  // Store server ref for graceful shutdown
  (app as any)._sseServer = server;
}

/**
 * Close the SSE server for graceful shutdown.
 */
export function closeSSEServer(): void {
  // Close all active transports
  for (const [sessionId, transport] of Object.entries(transports)) {
    try {
      transport.close();
    } catch (err) {
      console.error(`[context-mcp-server] Error closing transport ${sessionId}:`, err);
    }
    delete transports[sessionId];
  }
  console.error("[context-mcp-server] SSE server cleaned up");
}
