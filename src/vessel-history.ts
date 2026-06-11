import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, buildQuery, result } from "./helpers.js";

export function registerVesselHistoryTools(server: McpServer): void {
  server.registerTool(
    "get_track_trail",
    {
      description: "Get the historical movement path of a track as a GeoJSON LineString. Useful for visualizing a vessel's route over a time window.",
      inputSchema: {
        trackId: z.string().uuid().describe("Track UUID"),
        time: z.string().datetime().optional().describe("Start time in ISO 8601 format (defaults to now minus timeSpan)"),
        timeSpan: z.number().int().min(60).max(86400).optional().default(3600).describe("Seconds to look back from start time (60–86400, default 3600)"),
      },
    },
    async ({ trackId, ...query }) => {
      const data = await apiGet(`/vessel-history/api/v1/tracks/${trackId}/trail${buildQuery(query)}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_track_positions",
    {
      description: "Get historical position reports for a track as individual GeoJSON Points, each with timestamp and navigation data (SOG, COG, heading).",
      inputSchema: {
        trackId: z.string().uuid().describe("Track UUID"),
        time: z.string().datetime().optional().describe("Start time in ISO 8601 format (defaults to now minus timeSpan)"),
        interval: z.number().int().min(1).max(3600).optional().default(300).describe("Minimum seconds between returned positions (1–3600, default 300)"),
        timeSpan: z.number().int().min(60).max(86400).optional().default(3600).describe("Seconds to look back from start time (60–86400, default 3600)"),
      },
    },
    async ({ trackId, ...query }) => {
      const data = await apiGet(`/vessel-history/api/v1/tracks/${trackId}/positions${buildQuery(query)}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_vessel_trail",
    {
      description: "Get the complete historical movement trail of a vessel across all its tracking sessions as GeoJSON LineStrings. Covers up to 7 days.",
      inputSchema: {
        vesselId: z.string().uuid().describe("Vessel UUID"),
        time: z.string().datetime().optional().describe("Start time in ISO 8601 format (defaults to now minus timeSpan)"),
        timeSpan: z.number().int().min(3600).max(604800).optional().default(86400).describe("Seconds to look back from start time (3600–604800, default 86400)"),
      },
    },
    async ({ vesselId, ...query }) => {
      const data = await apiGet(`/vessel-history/api/v1/vessels/${vesselId}/trail${buildQuery(query)}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_vessel_positions",
    {
      description: "Get all historical position reports for a vessel across all tracking sessions as individual GeoJSON Points. Covers up to 7 days.",
      inputSchema: {
        vesselId: z.string().uuid().describe("Vessel UUID"),
        time: z.string().datetime().optional().describe("Start time in ISO 8601 format (defaults to now minus timeSpan)"),
        interval: z.number().int().min(30).max(3600).optional().default(300).describe("Minimum seconds between returned positions (30–3600, default 300)"),
        timeSpan: z.number().int().min(3600).max(604800).optional().default(86400).describe("Seconds to look back from start time (3600–604800, default 86400)"),
      },
    },
    async ({ vesselId, ...query }) => {
      const data = await apiGet(`/vessel-history/api/v1/vessels/${vesselId}/positions${buildQuery(query)}`);
      return result(data);
    },
  );
}
