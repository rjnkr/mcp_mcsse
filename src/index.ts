import "dotenv/config";
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

const server = new McpServer({
  name: "mcp_mcsse",
  version: "1.0.0",
});

registerVesselInfoTools(server);
registerTrackTools(server);
registerAlertTools(server);
registerGeoTools(server);
registerTopologyTools(server);
registerVoyageTools(server);
registerAisMailTools(server);

const tokenRefreshCron = process.env.TOKEN_REFRESH_CRON ?? "*/5 * * * *";
cron.schedule(tokenRefreshCron, async () => {
  try {
    await getAccessToken();
  } catch (err) {
    console.error("Token refresh failed:", err);
  }
});

const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
await server.connect(transport);

app.use(express.json());
app.all("/mcp", async (req, res) => {
  await transport.handleRequest(req, res, req.body);
});

app.listen(PORT, () => {
  console.error(`Server listening on port ${PORT}`);
  console.error(`  Login : http://localhost:${PORT}/login`);
  console.error(`  MCP   : http://localhost:${PORT}/mcp`);
});
