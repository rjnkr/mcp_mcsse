import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, apiPatch, apiDelete, buildQuery, result } from "./helpers.js";

const VoyageSource = z.enum(["Undefined", "PortCall", "Vts", "Ais", "Stm", "Extern", "Vdes"]);
const OutputFormat = z.enum(["Json", "GeoJson"]);

const VoyageBody = z.object({
  externalId: z.string().optional(),
  parentId: z.string().uuid().optional(),
  vesselId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  source: VoyageSource.optional(),
  status: z.string().optional(),
  mmsi: z.number().int().optional(),
  when: z.string().optional().describe("ISO 8601 start date-time"),
  whenIsConfirmed: z.boolean().optional(),
  maxDraught: z.number().optional(),
  endTime: z.string().optional().describe("ISO 8601 end date-time"),
  userProps: z.record(z.string().nullable()).optional(),
  waypoints: z.array(z.unknown()).optional(),
});

const JsonPatchOperation = z.object({
  op: z.string().describe("Operation: add, remove, replace, move, copy, test"),
  path: z.string().describe("JSON Pointer path"),
  from: z.string().optional(),
  value: z.unknown().optional(),
});

export function registerVoyageTools(server: McpServer): void {
  server.registerTool(
    "get_voyage",
    {
      description: "Get a voyage by its UUID.",
      inputSchema: {
        id: z.string().uuid().describe("Voyage UUID"),
        format: OutputFormat.default("Json"),
        includeWpPassageTime: z.boolean().optional().default(false).describe("Include waypoint passage times from external source"),
        dateTimeAtUtc: z.string().optional().describe("Get voyage state at this ISO 8601 date-time"),
      },
    },
    async ({ id, ...params }) => {
      const data = await apiGet(`/voyage/api/v1/voyage/${id}${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_voyage_by_external_id",
    {
      description: "Get a voyage by its external ID.",
      inputSchema: {
        externalid: z.string().describe("External voyage ID"),
        format: OutputFormat.default("Json"),
        includeWpPassageTime: z.boolean().optional().default(false),
        dateTimeAtUtc: z.string().optional().describe("ISO 8601 date-time for point-in-time query"),
      },
    },
    async ({ externalid, ...params }) => {
      const data = await apiGet(`/voyage/api/v1/voyage/voyage/${externalid}${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_voyages_by_parent_id",
    {
      description: "Get all voyages with the specified parent ID (usually a port call ID).",
      inputSchema: {
        parentid: z.string().uuid().describe("Parent UUID (port call ID)"),
        format: OutputFormat,
        include_waypoints: z.boolean().optional().default(true),
        recalculate_eta: z.boolean().optional().default(false),
        dateTimeAtUtc: z.string().optional().describe("ISO 8601 date-time for point-in-time query"),
      },
    },
    async ({ parentid, ...params }) => {
      const data = await apiGet(`/voyage/api/v1/voyage/parent/${parentid}${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_voyages_by_user_property",
    {
      description: "Get voyages that have a specific user property key/value pair.",
      inputSchema: {
        propertyKey: z.string().describe("User property key"),
        propertyValue: z.string().describe("User property value"),
        format: OutputFormat,
        searchStartTimeUtc: z.string().optional().describe("Search window start (default: 2 days ago)"),
        searchEndTimeUtc: z.string().optional().describe("Search window end (default: 2 days ahead)"),
        dateTimeAtUtc: z.string().optional().describe("ISO 8601 date-time for point-in-time query"),
      },
    },
    async (params) => {
      const data = await apiGet(`/voyage/api/v1/voyage/userproperty${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_vessels_with_voyages",
    {
      description: "Get vessel identifications that have at least one voyage within the specified time window.",
      inputSchema: {
        searchStartTimeUtc: z.string().optional().describe("Start time (default: 2 days ago)"),
        searchEndTimeUtc: z.string().optional().describe("End time (default: now)"),
        changeLogTimeUtc: z.string().optional().describe("ISO 8601 date-time for point-in-time query"),
      },
    },
    async (params) => {
      const data = await apiGet(`/voyage/api/v1/voyage/vessels${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_voyages_by_time",
    {
      description: "Get voyages for a vessel or all vessels within a time window (paged).",
      inputSchema: {
        vesselId_or_Mmsi: z.string().optional().describe("Vessel UUID or MMSI — leave empty for all vessels"),
        source: VoyageSource.optional().default("Undefined"),
        activeTimeUtc: z.string().optional().describe("ISO 8601 date-time defining when a voyage is active"),
        include_waypoints: z.boolean().optional().default(false),
        isMovement: z.boolean().optional(),
        recalculate_eta: z.boolean().optional().default(false),
        pageoffset: z.number().int().optional().default(0),
        pagesize: z.number().int().optional().default(100),
        searchStart: z.string().optional().describe("Search window start"),
        searchEnd: z.string().optional().describe("Search window end"),
        changeLogTime: z.string().optional().describe("ISO 8601 date-time for point-in-time query"),
      },
    },
    async (params) => {
      const data = await apiGet(`/voyage/api/v1/voyage/voyagesbytime${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_voyages_by_status",
    {
      description: "Get voyages filtered by one or more user-defined status values (paged).",
      inputSchema: {
        statuses: z.string().optional().default("").describe("Comma-separated status values, e.g. 'Status1,Status2'"),
        vesselId_or_Mmsi: z.string().optional().describe("Vessel UUID or MMSI — leave empty for all vessels"),
        source: VoyageSource.optional().default("Undefined"),
        include_waypoints: z.boolean().optional().default(false),
        pageoffset: z.number().int().optional().default(0),
        pagesize: z.number().int().optional().default(100),
        searchStart: z.string().optional(),
        searchEnd: z.string().optional(),
        changeLogTime: z.string().optional(),
      },
    },
    async (params) => {
      const data = await apiGet(`/voyage/api/v1/voyage/voyagesbystatus${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_voyages_passing_waypoint",
    {
      description: "Get voyages that pass a specific topology waypoint within a time window (paged).",
      inputSchema: {
        waypointId: z.string().uuid().optional().describe("Topology waypoint UUID"),
        source: VoyageSource.optional().default("Undefined"),
        passageStartingAt: z.string().optional().describe("Window start (default: 2 days ago)"),
        passageUntil: z.string().optional().describe("Window end (default: 2 days ahead)"),
        recalculate_eta: z.boolean().optional().default(false),
        pageoffset: z.number().int().optional().default(0),
        pagesize: z.number().int().optional().default(100),
        changeLogTime: z.string().optional(),
      },
    },
    async (params) => {
      const data = await apiGet(`/voyage/api/v1/voyage/voyagespassingwaypoint${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_voyage_changelog",
    {
      description: "Get the change history for a voyage.",
      inputSchema: {
        id: z.string().uuid().describe("Voyage UUID"),
      },
    },
    async ({ id }) => {
      const data = await apiGet(`/voyage/api/v1/voyage/changelog/${id}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_voyage_statuses",
    {
      description: "Get all possible voyage status values.",
      inputSchema: {},
    },
    async () => {
      const data = await apiGet("/voyage/api/v1/voyage/voyagestatus");
      return result(data);
    },
  );

  server.registerTool(
    "create_voyage",
    {
      description: "Create a new voyage.",
      inputSchema: {
        addReason: z.string().optional().describe("Optional creation reason"),
        ...VoyageBody.shape,
      },
    },
    async ({ addReason, ...body }) => {
      const data = await apiPost(`/voyage/api/v1/voyage${buildQuery({ addReason })}`, body);
      return result(data);
    },
  );

  server.registerTool(
    "update_voyage",
    {
      description: "Replace an existing voyage with new data.",
      inputSchema: {
        id: z.string().uuid().describe("Voyage UUID"),
        addReason: z.string().optional(),
        ...VoyageBody.shape,
      },
    },
    async ({ id, addReason, ...body }) => {
      const data = await apiPut(`/voyage/api/v1/voyage/${id}${buildQuery({ addReason })}`, body);
      return result(data);
    },
  );

  server.registerTool(
    "patch_voyage",
    {
      description: "Patch one or more fields of an existing voyage using RFC 6902 JSON Patch operations.",
      inputSchema: {
        id: z.string().uuid().describe("Voyage UUID"),
        addReason: z.string().optional(),
        operations: z.array(JsonPatchOperation).describe("JSON Patch operations array"),
      },
    },
    async ({ id, addReason, operations }) => {
      const data = await apiPatch(`/voyage/api/v1/voyage/${id}${buildQuery({ addReason })}`, operations);
      return result(data);
    },
  );

  server.registerTool(
    "create_voyage_from_geojson_path",
    {
      description: "Create a new voyage from a GeoJSON FeatureCollection as produced by the topology service.",
      inputSchema: {
        vesselId_or_Mmsi: z.string().describe("Vessel UUID or MMSI"),
        source: VoyageSource,
        addReason: z.string().optional(),
        featureCollection: z.object({
          type: z.literal("FeatureCollection"),
          features: z.array(z.object({
            type: z.literal("Feature"),
            properties: z.record(z.unknown()).nullable(),
            geometry: z.unknown(),
          })),
        }).describe("GeoJSON FeatureCollection with waypoints"),
      },
    },
    async ({ vesselId_or_Mmsi, source, addReason, featureCollection }) => {
      const data = await apiPost(
        `/voyage/api/v1/voyage/fromgeojsonpath${buildQuery({ vesselId_or_Mmsi, source, addReason })}`,
        featureCollection,
      );
      return result(data);
    },
  );

  server.registerTool(
    "delete_voyage",
    {
      description: "Delete a voyage. Soft delete sets a deleted flag; hard delete is irreversible.",
      inputSchema: {
        id: z.string().uuid().describe("Voyage UUID"),
        hardDelete: z.boolean().optional().default(false).describe("Hard delete is irreversible"),
      },
    },
    async ({ id, hardDelete }) => {
      await apiDelete(`/voyage/api/v1/voyage/delete/${id}${buildQuery({ hardDelete })}`);
      return result({ success: true, message: `Voyage ${id} deleted.` });
    },
  );

  server.registerTool(
    "delete_voyages_by_parent_id",
    {
      description: "Delete all voyages with the specified parent ID. Soft delete sets a deleted flag; hard delete is irreversible.",
      inputSchema: {
        id: z.string().uuid().describe("Parent UUID"),
        hardDelete: z.boolean().optional().default(false),
      },
    },
    async ({ id, hardDelete }) => {
      await apiDelete(`/voyage/api/v1/voyage/deletebyparentid/${id}${buildQuery({ hardDelete })}`);
      return result({ success: true, message: `Voyages with parent ${id} deleted.` });
    },
  );

  server.registerTool(
    "set_voyage_cancelled",
    {
      description: "Mark a voyage as cancelled (changes status to 'Cancelled').",
      inputSchema: {
        voyageid: z.string().uuid().describe("Voyage UUID"),
        reason: z.string().optional(),
      },
    },
    async ({ voyageid, reason }) => {
      const data = await apiPatch(`/voyage/api/v1/voyage/${voyageid}/cancelled${buildQuery({ reason })}`);
      return result(data);
    },
  );

  server.registerTool(
    "set_voyage_started",
    {
      description: "Mark a voyage as started (changes status to 'Active' and confirms the start time).",
      inputSchema: {
        voyageid: z.string().uuid().describe("Voyage UUID"),
        startTime: z.string().optional().describe("ISO 8601 start date-time (default: now)"),
        addReason: z.string().optional(),
      },
    },
    async ({ voyageid, ...params }) => {
      const data = await apiPatch(`/voyage/api/v1/voyage/${voyageid}/started${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "set_voyage_completed",
    {
      description: "Mark a voyage as completed (changes status to 'Completed' and confirms the end time).",
      inputSchema: {
        voyageid: z.string().uuid().describe("Voyage UUID"),
        endTime: z.string().optional().describe("ISO 8601 end date-time (default: now)"),
        addReason: z.string().optional(),
      },
    },
    async ({ voyageid, ...params }) => {
      const data = await apiPatch(`/voyage/api/v1/voyage/${voyageid}/completed${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "set_voyage_agent",
    {
      description: "Set the agent (company) for a voyage.",
      inputSchema: {
        voyageid: z.string().uuid().describe("Voyage UUID"),
        agentid: z.string().uuid().describe("Agent (company) UUID"),
        reason: z.string().optional(),
      },
    },
    async ({ voyageid, agentid, reason }) => {
      const data = await apiPatch(`/voyage/api/v1/voyage/${voyageid}/agent/${agentid}${buildQuery({ reason })}`);
      return result(data);
    },
  );

  server.registerTool(
    "set_voyage_waypoint_passage",
    {
      description: "Record that a vessel has passed a specific waypoint on a voyage.",
      inputSchema: {
        voyageid: z.string().uuid().describe("Voyage UUID"),
        waypointid: z.string().uuid().describe("Topology waypoint UUID"),
        passagetime: z.string().optional().describe("ISO 8601 passage date-time"),
        addReason: z.string().optional(),
      },
    },
    async ({ voyageid, waypointid, ...params }) => {
      const data = await apiPatch(`/voyage/api/v1/voyage/${voyageid}/waypointpassage/${waypointid}${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "set_voyage_pilot_on_board",
    {
      description: "Record that a pilot has boarded for a voyage.",
      inputSchema: {
        voyageid: z.string().uuid().describe("Voyage UUID"),
        onBoardTime: z.string().optional().describe("ISO 8601 boarding time (default: now)"),
        vesselId: z.string().uuid().optional(),
        addReason: z.string().optional(),
      },
    },
    async ({ voyageid, ...params }) => {
      const data = await apiPatch(`/voyage/api/v1/voyage/${voyageid}/pilotonboard${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "set_voyage_pilot_finished",
    {
      description: "Record that a pilot has disembarked from a voyage.",
      inputSchema: {
        voyageid: z.string().uuid().describe("Voyage UUID"),
        finishTime: z.string().optional().describe("ISO 8601 disembark time (default: now)"),
        vesselId: z.string().uuid().optional(),
        addReason: z.string().optional(),
      },
    },
    async ({ voyageid, ...params }) => {
      const data = await apiPatch(`/voyage/api/v1/voyage/${voyageid}/pilotfinished${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_voyage_pilot_service",
    {
      description: "Get pilot service details for a voyage.",
      inputSchema: {
        voyageid: z.string().uuid().describe("Voyage UUID"),
        dateTimeAt: z.string().optional().describe("ISO 8601 date-time for point-in-time query"),
      },
    },
    async ({ voyageid, ...params }) => {
      const data = await apiGet(`/voyage/api/v1/voyage/${voyageid}/pilot${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_voyage_tug_service",
    {
      description: "Get tug service details for a voyage.",
      inputSchema: {
        voyageid: z.string().uuid().describe("Voyage UUID"),
        dateTimeAt: z.string().optional().describe("ISO 8601 date-time for point-in-time query"),
      },
    },
    async ({ voyageid, ...params }) => {
      const data = await apiGet(`/voyage/api/v1/voyage/${voyageid}/tug${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_voyage_linesmen_service",
    {
      description: "Get linesmen service details for a voyage.",
      inputSchema: {
        voyageid: z.string().uuid().describe("Voyage UUID"),
        dateTimeAt: z.string().optional().describe("ISO 8601 date-time for point-in-time query"),
      },
    },
    async ({ voyageid, ...params }) => {
      const data = await apiGet(`/voyage/api/v1/voyage/${voyageid}/linesmen${buildQuery(params)}`);
      return result(data);
    },
  );

  // ── Cross-service enrichment ──────────────────────────────────────────────

  server.registerTool(
    "get_voyage_with_vessel_details",
    {
      description: "Get a voyage by UUID and enrich it with full vessel details from the vessel information service.",
      inputSchema: {
        id: z.string().uuid().describe("Voyage UUID"),
        format: OutputFormat.default("Json"),
        includeWpPassageTime: z.boolean().optional().default(false),
        dateTimeAtUtc: z.string().optional().describe("ISO 8601 date-time for point-in-time query"),
      },
    },
    async ({ id, ...params }) => {
      const voyages = await apiGet(`/voyage/api/v1/voyage/${id}${buildQuery(params)}`) as unknown[] | null;
      const voyage = Array.isArray(voyages) ? voyages[0] : voyages;
      if (!voyage) return result(null);

      const vesselId = (voyage as Record<string, unknown>).vesselId as string | undefined;
      let vessel = null;
      if (vesselId) {
        try {
          vessel = await apiGet(`/vesselinfo/api/v1/vesselinfo/detailedvessel/${vesselId}`);
        } catch {
          vessel = { error: `Could not load vessel details for id ${vesselId}` };
        }
      }

      return result({ voyage, vessel });
    },
  );

  server.registerTool(
    "get_voyages_by_time_with_vessel_details",
    {
      description: "Get voyages within a time window and enrich each with vessel details from the vessel information service.",
      inputSchema: {
        vesselId_or_Mmsi: z.string().optional().describe("Vessel UUID or MMSI — leave empty for all vessels"),
        source: VoyageSource.optional().default("Undefined"),
        include_waypoints: z.boolean().optional().default(false),
        pageoffset: z.number().int().optional().default(0),
        pagesize: z.number().int().optional().default(20).describe("Keep low to avoid slow responses"),
        searchStart: z.string().optional(),
        searchEnd: z.string().optional(),
        changeLogTime: z.string().optional(),
      },
    },
    async (params) => {
      const collection = await apiGet(`/voyage/api/v1/voyage/voyagesbytime${buildQuery(params)}`) as { voyages?: Record<string, unknown>[] } | null;
      const voyages = collection?.voyages ?? [];

      const enriched = await Promise.all(
        voyages.map(async (voyage) => {
          const vesselId = voyage.vesselId as string | undefined;
          let vessel = null;
          if (vesselId) {
            try {
              vessel = await apiGet(`/vesselinfo/api/v1/vesselinfo/detailedvessel/${vesselId}`);
            } catch {
              vessel = { error: `Could not load vessel details for id ${vesselId}` };
            }
          }
          return { voyage, vessel };
        }),
      );

      return result(enriched);
    },
  );
}
