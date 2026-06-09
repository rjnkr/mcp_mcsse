import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, apiPatch, apiDelete, buildQuery, result } from "./helpers.js";

export function registerVesselInfoTools(server: McpServer): void {
  server.registerTool(
    "get_vessel_by_id",
    {
      description: "Get a thin (high-performance) vessel by its UUID. Does not include all fields — use get_detailed_vessel_by_id for full details.",
      inputSchema: {
        id: z.string().uuid().describe("Vessel UUID"),
        specificTime: z.string().optional().describe("ISO 8601 date-time to query a specific point in time"),
      },
    },
    async ({ id, specificTime }) => {
      const data = await apiGet(`/vesselinfo/api/v1/vesselinfo/vessel/${id}${buildQuery({ specificTime })}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_detailed_vessel_by_id",
    {
      description: "Get full detailed vessel information by its UUID.",
      inputSchema: {
        id: z.string().uuid().describe("Vessel UUID"),
        specificTime: z.string().optional().describe("ISO 8601 date-time to query a specific point in time"),
      },
    },
    async ({ id, specificTime }) => {
      const data = await apiGet(`/vesselinfo/api/v1/vesselinfo/detailedvessel/${id}${buildQuery({ specificTime })}`);
      return result(data);
    },
  );

  server.registerTool(
    "search_vessels_by_name",
    {
      description: "Search vessels by name (partial match).",
      inputSchema: {
        criteria: z.string().describe("Name search string"),
        limit: z.number().int().optional().default(25).describe("Max results (default 25)"),
        specificTime: z.string().optional().describe("ISO 8601 date-time"),
      },
    },
    async ({ criteria, limit, specificTime }) => {
      const data = await apiGet(`/vesselinfo/api/v1/vesselinfo/vesselfromname${buildQuery({ criteria, limit, specificTime })}`);
      return result(data);
    },
  );

  server.registerTool(
    "search_vessels",
    {
      description: "Search vessels by a free-text criteria (matches name, MMSI, IMO, callsign).",
      inputSchema: {
        criteria: z.string().optional().describe("Free-text search string"),
        specificTime: z.string().optional().describe("ISO 8601 date-time"),
      },
    },
    async ({ criteria, specificTime }) => {
      const data = await apiGet(`/vesselinfo/api/v1/vesselinfo/vessels${buildQuery({ criteria, specificTime })}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_vessels_by_mmsi",
    {
      description: "Get detailed vessels by a list of MMSI numbers.",
      inputSchema: {
        mmsis: z.array(z.number().int()).describe("List of MMSI numbers"),
        specificTime: z.string().optional().describe("ISO 8601 date-time"),
      },
    },
    async ({ mmsis, specificTime }) => {
      const data = await apiGet(`/vesselinfo/api/v1/vesselinfo/vessel${buildQuery({ mmsis, specificTime })}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_vessel_by_external_id",
    {
      description: "Get a detailed vessel by its external ID.",
      inputSchema: {
        externalId: z.string().describe("External vessel ID"),
        specificTime: z.string().optional().describe("ISO 8601 date-time"),
      },
    },
    async ({ externalId, specificTime }) => {
      const data = await apiGet(`/vesselinfo/api/v1/vesselinfo/vesselbyexternalid${buildQuery({ externalId, specificTime })}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_vessel_history",
    {
      description: "Get the full change history of a vessel by its UUID.",
      inputSchema: {
        vid: z.string().uuid().describe("Vessel UUID"),
      },
    },
    async ({ vid }) => {
      const data = await apiGet(`/vesselinfo/api/v1/vesselinfo/vesselhistoryfromid${buildQuery({ vid })}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_paginated_detailed_vessels",
    {
      description: "Get all detailed vessels with pagination and optional filters.",
      inputSchema: {
        PageNumber: z.number().int().optional(),
        PageSize: z.number().int().optional(),
        Name: z.string().optional(),
        MMSI: z.number().int().optional(),
        IMO: z.number().int().optional(),
        Callsign: z.string().optional(),
        sortBy: z.enum(["Name", "MMSI", "IMO", "Callsign", "CreationTime", "UpdateTime"]).optional(),
        sortOrder: z.enum(["Ascending", "Descending"]).optional(),
        specificTime: z.string().optional(),
      },
    },
    async (params) => {
      const data = await apiGet(`/vesselinfo/api/v1/vesselinfo/paginateddetailedvessels${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_thin_vessels",
    {
      description: "Get all thin vessels (lightweight, high-performance) with optional search criteria.",
      inputSchema: {
        criteria: z.string().optional().describe("Search string"),
        specificTime: z.string().optional(),
      },
    },
    async ({ criteria, specificTime }) => {
      const data = await apiGet(`/vesselinfo/api/v1/vesselinfo/thinvessels${buildQuery({ criteria, specificTime })}`);
      return result(data);
    },
  );

  server.registerTool(
    "create_vessel",
    {
      description: "Create a new manual vessel.",
      inputSchema: {
        Name: z.string().optional(),
        MMSI: z.number().int().optional(),
        IMO: z.number().int().optional(),
        Callsign: z.string().optional(),
        ShipType: z.string().optional(),
        Draught: z.number().optional(),
        LengthOverall: z.number().optional(),
        WidthExtreme: z.number().optional(),
        GrossTonnage: z.number().int().optional(),
        NetTonnage: z.number().int().optional(),
        MaximumSpeed: z.number().optional(),
        Destination: z.string().optional(),
        Notes: z.string().optional(),
        ExternalVesselId: z.string().optional(),
      },
    },
    async (body) => {
      const data = await apiPost("/vesselinfo/api/v1/vesselinfo/manualvessel", body);
      return result(data);
    },
  );

  server.registerTool(
    "update_vessel",
    {
      description: "Update non-null properties of an existing manual vessel (PATCH).",
      inputSchema: {
        Id: z.string().uuid().describe("Vessel UUID to update (required)"),
        Name: z.string().optional(),
        MMSI: z.number().int().optional(),
        IMO: z.number().int().optional(),
        Callsign: z.string().optional(),
        ShipType: z.string().optional(),
        Draught: z.number().optional(),
        LengthOverall: z.number().optional(),
        WidthExtreme: z.number().optional(),
        GrossTonnage: z.number().int().optional(),
        NetTonnage: z.number().int().optional(),
        MaximumSpeed: z.number().optional(),
        Destination: z.string().optional(),
        Notes: z.string().optional(),
        ExternalVesselId: z.string().optional(),
      },
    },
    async (body) => {
      const data = await apiPatch("/vesselinfo/api/v1/vesselinfo/manualvessel", body);
      return result(data);
    },
  );

  server.registerTool(
    "delete_vessel",
    {
      description: "Flag a vessel as deleted by its UUID.",
      inputSchema: {
        id: z.string().uuid().describe("Vessel UUID to delete"),
      },
    },
    async ({ id }) => {
      await apiDelete(`/vesselinfo/api/v1/vesselinfo/vessel/${id}`);
      return result({ success: true, message: `Vessel ${id} flagged as deleted.` });
    },
  );

  server.registerTool(
    "undo_delete_vessel",
    {
      description: "Restore a previously deleted vessel by its UUID.",
      inputSchema: {
        id: z.string().uuid().describe("Vessel UUID to restore"),
      },
    },
    async ({ id }) => {
      await apiPatch(`/vesselinfo/api/v1/vesselinfo/vessel/${id}/undodelete`);
      return result({ success: true, message: `Vessel ${id} restored.` });
    },
  );

  server.registerTool(
    "get_most_matching_vessel",
    {
      description: "Find the most matching vessel using the manual vessel matching algorithm. Provide as many fields as known.",
      inputSchema: {
        Name: z.string().optional(),
        MMSI: z.number().int().optional(),
        IMO: z.number().int().optional(),
        Callsign: z.string().optional(),
        ShipType: z.string().optional(),
        Destination: z.string().optional(),
      },
    },
    async (params) => {
      const data = await apiGet(`/vesselinfo/api/v1/vesselinfo/mostmatchingvessel${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "upsert_sensor_vessel",
    {
      description: "Create or update a vessel from sensor/AIS data using the sensor matching algorithm.",
      inputSchema: {
        mmsi: z.number().int().optional(),
        imo: z.number().int().optional(),
        name: z.string().optional(),
        callsign: z.string().optional(),
        shipType: z.string().optional(),
        draught: z.number().optional(),
        destination: z.string().optional(),
      },
    },
    async (body) => {
      const data = await apiPut("/vesselinfo/api/v1/vesselinfo/sensorvessel", body);
      return result(data);
    },
  );
}
