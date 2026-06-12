import "dotenv/config";
import { randomUUID } from "crypto";
import express from "express";
import { app, PORT } from "./web-login.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import cron from "node-cron";
import { getAccessToken } from "./auth.js";
import { registerVesselInfoTools } from "./vesselinfo.js";
import { registerTrackTools } from "./tracks.js";
import { registerAlertTools } from "./alert.js";
import { registerGeoTools } from "./geo.js";
import { registerTopologyTools } from "./topology.js";
import { registerVoyageTools } from "./voyage.js";
import { registerAisMailTools } from "./aismail.js";
import { registerVesselHistoryTools } from "./vessel-history.js";

// ── Session registry ──────────────────────────────────────────────────────────

const sessions = new Map<string, StreamableHTTPServerTransport>();

function createSession(): { server: McpServer; transport: StreamableHTTPServerTransport } {
  const sessionServer = new McpServer({ name: "mcp_mcsse", version: "1.0.0" });
  registerVesselInfoTools(sessionServer);
  registerTrackTools(sessionServer);
  registerAlertTools(sessionServer);
  registerGeoTools(sessionServer);
  registerTopologyTools(sessionServer);
  registerVoyageTools(sessionServer);
  registerAisMailTools(sessionServer);
  registerVesselHistoryTools(sessionServer);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  transport.onclose = () => {
    if (transport.sessionId) {
      sessions.delete(transport.sessionId);
      console.error(`[MCP] Session ${transport.sessionId} closed, active: ${sessions.size}`);
    }
  };

  return { server: sessionServer, transport };
}

// ── Token refresh cron ────────────────────────────────────────────────────────

const tokenRefreshCron = process.env.TOKEN_REFRESH_CRON ?? "*/5 * * * *";
cron.schedule(tokenRefreshCron, async () => {
  try {
    await getAccessToken();
  } catch (err) {
    console.error("Token refresh failed:", err);
  }
});

// ── MCP endpoint ──────────────────────────────────────────────────────────────

app.use(express.json());
app.all("/mcp", async (req, res) => {
  try {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId) {
      const transport = sessions.get(sessionId);
      if (!transport) {
        console.error(`[MCP] Unknown session ${sessionId} — client must reinitialize`);
        res.status(404).json({ error: "Session not found. Please reinitialize." });
        return;
      }
      await transport.handleRequest(req, res, req.body);
      return;
    }

    // No session ID — new client connecting
    const { server: sessionServer, transport } = createSession();
    await sessionServer.connect(transport);
    await transport.handleRequest(req, res, req.body);

    if (transport.sessionId) {
      sessions.set(transport.sessionId, transport);
      console.error(`[MCP] Session ${transport.sessionId} created, active: ${sessions.size}`);
    }
  } catch (err) {
    console.error("[MCP] Unhandled error in /mcp handler:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// ── Express error middleware ──────────────────────────────────────────────────

app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`[Express] Unhandled error on ${req.method} ${req.path}:`, err);
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal server error" });
  }
});

process.on("uncaughtException", (err) => {
  console.error("[Process] Uncaught exception:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[Process] Unhandled promise rejection:", reason);
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.error(`Server listening on port ${PORT}`);
  console.error(`  Login : http://localhost:${PORT}/login`);
  console.error(`  MCP   : http://localhost:${PORT}/mcp`);
});