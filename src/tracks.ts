import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, buildQuery, result } from "./helpers.js";

export function registerTrackTools(server: McpServer): void {
  server.registerTool(
    "get_tracks",
    {
      description: "Get all live tracks with optional search and filtering. Returns GeoJSON FeatureCollection.",
      inputSchema: {
        search: z.string().optional().describe("Search string (vessel name, MMSI, callsign)"),
        vesselId: z.string().optional().describe("Filter by vessel UUID"),
        limit: z.number().int().optional().default(100).describe("Max tracks to return (default 100)"),
        sort: z.enum(["name:asc","name:desc","mmsi:asc","mmsi:desc","callsign:asc","callsign:desc","length:asc","length:desc"]).optional().default("name:asc"),
      },
    },
    async (params) => {
      const data = await apiGet(`/track/api/v1/tracks${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_tracks_in_bbox",
    {
      description: "Get all tracks within a geographic bounding box. Returns GeoJSON FeatureCollection.",
      inputSchema: {
        minLon: z.number().min(-180).max(180).describe("Minimum longitude (west)"),
        minLat: z.number().min(-90).max(90).describe("Minimum latitude (south)"),
        maxLon: z.number().min(-180).max(180).describe("Maximum longitude (east)"),
        maxLat: z.number().min(-90).max(90).describe("Maximum latitude (north)"),
        limit: z.number().int().min(1).max(1000).optional().default(100).describe("Max tracks to return"),
        sort: z.enum(["name:asc","name:desc","mmsi:asc","mmsi:desc","distance:asc","distance:desc"]).optional().default("name:asc"),
      },
    },
    async (params) => {
      const data = await apiGet(`/track/api/v1/tracks/bbox${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_track_by_id",
    {
      description: "Get a single track by its ID. Returns a GeoJSON Feature with full track details.",
      inputSchema: {
        id: z.string().describe("Track ID"),
      },
    },
    async ({ id }) => {
      const data = await apiGet(`/track/api/v1/tracks/${id}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_track_with_vessel_details",
    {
      description: "Get a track by ID and enrich it with full vessel details from the vessel information service using the track's vesselId.",
      inputSchema: {
        id: z.string().describe("Track ID"),
      },
    },
    async ({ id }) => {
      const track = await apiGet(`/track/api/v1/tracks/${id}`) as Record<string, unknown> | null;
      if (!track) return result(null);

      const properties = track.properties as Record<string, unknown> | undefined;
      const vesselId = properties?.vesselId as string | undefined;

      let vessel = null;
      if (vesselId) {
        try {
          vessel = await apiGet(`/vesselinfo/api/v1/vesselinfo/detailedvessel/${vesselId}`);
        } catch {
          vessel = { error: `Could not load vessel details for id ${vesselId}` };
        }
      }

      return result({ track, vessel });
    },
  );

  server.registerTool(
    "get_tracks_with_vessel_details",
    {
      description: "Get tracks (optionally filtered) and enrich each with vessel details. Useful for a combined situational picture.",
      inputSchema: {
        search: z.string().optional().describe("Search string (vessel name, MMSI, callsign)"),
        vesselId: z.string().optional().describe("Filter by vessel UUID"),
        limit: z.number().int().optional().default(20).describe("Max tracks to return (default 20, keep low to avoid slow responses)"),
        sort: z.enum(["name:asc","name:desc","mmsi:asc","mmsi:desc","callsign:asc","callsign:desc","length:asc","length:desc"]).optional().default("name:asc"),
      },
    },
    async (params) => {
      const collection = await apiGet(`/track/api/v1/tracks${buildQuery(params)}`) as { features?: Record<string, unknown>[] } | null;
      const features = collection?.features ?? [];

      const enriched = await Promise.all(
        features.map(async (track) => {
          const properties = track.properties as Record<string, unknown> | undefined;
          const vesselId = properties?.vesselId as string | undefined;
          let vessel = null;
          if (vesselId) {
            try {
              vessel = await apiGet(`/vesselinfo/api/v1/vesselinfo/detailedvessel/${vesselId}`);
            } catch {
              vessel = { error: `Could not load vessel details for id ${vesselId}` };
            }
          }
          return { track, vessel };
        }),
      );

      return result(enriched);
    },
  );

  server.registerTool(
    "get_track_sources",
    {
      description: "Get available track sources (AIS, radar, etc.).",
      inputSchema: {},
    },
    async () => {
      const data = await apiGet("/track/api/v1/tracks/sources");
      return result(data);
    },
  );
}
