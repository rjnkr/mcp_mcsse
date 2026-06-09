import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, apiDelete, buildQuery, result } from "./helpers.js";

const Geometry = z.union([
  z.object({ type: z.literal("Point"), coordinates: z.array(z.number()) }),
  z.object({ type: z.literal("LineString"), coordinates: z.array(z.array(z.number())) }),
  z.object({ type: z.literal("Polygon"), coordinates: z.array(z.array(z.array(z.number()))) }),
  z.object({ type: z.literal("MultiPoint"), coordinates: z.array(z.array(z.number())) }),
  z.object({ type: z.literal("MultiLineString"), coordinates: z.array(z.array(z.array(z.number()))) }),
  z.object({ type: z.literal("MultiPolygon"), coordinates: z.array(z.array(z.array(z.array(z.number())))) }),
  z.object({ type: z.literal("GeometryCollection"), geometries: z.array(z.unknown()) }),
]).nullable();

const Feature = z.object({
  type: z.literal("Feature"),
  id: z.union([z.string(), z.number()]).optional(),
  properties: z.record(z.unknown()).nullable(),
  geometry: Geometry,
});

export function registerGeoTools(server: McpServer): void {
  server.registerTool(
    "get_feature",
    {
      description: "Get a GeoJSON feature by its UUID.",
      inputSchema: {
        id: z.string().uuid().describe("Feature UUID"),
      },
    },
    async ({ id }) => {
      const data = await apiGet(`/geo/api/v1/feature/${id}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_features",
    {
      description: "Get a paginated list of GeoJSON features with optional property filter.",
      inputSchema: {
        after: z.string().optional().describe("Cursor for pagination — feature ID to start after"),
        limit: z.number().int().min(1).max(100).optional().describe("Number of features to return (1–100)"),
        filter: z.string().optional().describe("Key=value filter on feature properties. Use * to match any value where property exists."),
      },
    },
    async (params) => {
      const data = await apiGet(`/geo/api/v1/feature${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "create_feature",
    {
      description: "Create a new GeoJSON feature. Properties must include a 'name' field.",
      inputSchema: {
        feature: Feature.describe("GeoJSON Feature to create"),
      },
    },
    async ({ feature }) => {
      const data = await apiPost("/geo/api/v1/feature", feature);
      return result(data);
    },
  );

  server.registerTool(
    "replace_feature",
    {
      description: "Replace an existing GeoJSON feature by its UUID.",
      inputSchema: {
        id: z.string().uuid().describe("Feature UUID"),
        feature: Feature.describe("Replacement GeoJSON Feature"),
      },
    },
    async ({ id, feature }) => {
      const data = await apiPut(`/geo/api/v1/feature/${id}`, feature);
      return result(data);
    },
  );

  server.registerTool(
    "delete_feature",
    {
      description: "Delete a GeoJSON feature by its UUID.",
      inputSchema: {
        id: z.string().uuid().describe("Feature UUID"),
      },
    },
    async ({ id }) => {
      await apiDelete(`/geo/api/v1/feature/${id}`);
      return result({ success: true, message: `Feature ${id} deleted.` });
    },
  );

  server.registerTool(
    "search_features_by_name",
    {
      description: "Search GeoJSON features by name (partial match) and optional geometry type.",
      inputSchema: {
        name: z.string().optional().describe("Name or partial name to search for"),
        type: z.enum(["Point", "LineString", "Polygon"]).optional().describe("Geometry type filter"),
        after: z.string().optional().describe("Cursor for pagination"),
        limit: z.number().int().min(1).max(100).optional().describe("Number of features to return (1–100)"),
        propertiesFilter: z.string().optional(),
      },
    },
    async (params) => {
      const data = await apiGet(`/geo/api/v1/feature/searchbyname${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "create_feature_collection",
    {
      description: "Create multiple GeoJSON features at once from a FeatureCollection.",
      inputSchema: {
        type: z.literal("FeatureCollection"),
        features: z.array(Feature).describe("Array of GeoJSON features to create"),
      },
    },
    async (body) => {
      const data = await apiPost("/geo/api/v1/feature/featurecollection", body);
      return result(data);
    },
  );

  server.registerTool(
    "get_features_in_bounding_box",
    {
      description: "Get GeoJSON features whose geometry lies entirely within the provided polygon bounding box.",
      inputSchema: {
        polygon: z.object({
          type: z.literal("Polygon"),
          coordinates: z.array(z.array(z.array(z.number()))).describe("Polygon ring coordinates"),
          bbox: z.array(z.number()).min(4).optional(),
        }).describe("GeoJSON Polygon defining the bounding area"),
        after: z.string().optional().describe("Cursor for pagination"),
        limit: z.number().int().optional().describe("Number of features to return"),
        filter: z.string().optional().describe("Key=value filter on feature properties"),
      },
    },
    async ({ polygon, after, limit, filter }) => {
      const data = await apiPost(`/geo/api/v1/feature/inboundingbox${buildQuery({ after, limit, filter })}`, polygon);
      return result(data);
    },
  );
}
