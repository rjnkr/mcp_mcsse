import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, apiDelete, buildQuery, result } from "./helpers.js";

const NodeType = z.enum([
  "Undefined", "PortArea", "Grouping", "RouteAreaBoundary", "RoutePassage",
  "RouteReporting", "RouteAnchorage", "RouteMooring", "RoutePilotBoarding",
  "RouteBridge", "RouteLock", "Bollard", "AnchorPoint", "Resource", "RouteLockDoor",
]);

const GeoPoint = z.object({
  type: z.literal("Point"),
  coordinates: z.array(z.number()).min(2),
  bbox: z.array(z.number()).optional(),
}).nullable();

const GeoPolygon = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.array(z.number()))),
  bbox: z.array(z.number()).optional(),
}).nullable();

const GeoLineString = z.object({
  type: z.literal("LineString"),
  coordinates: z.array(z.array(z.number()).min(2)).min(2),
  bbox: z.array(z.number()).optional(),
}).nullable();

const PathRestrictions = z.object({
  maxLength: z.number().optional().describe("Max length [meters]"),
  maxBreadth: z.number().optional().describe("Max breadth [meters]"),
  maxDraught: z.number().optional().describe("Max draught [meters]"),
  maxHeight: z.number().optional().describe("Max height [meters]"),
  speedLimit: z.number().optional().describe("Speed limit [knots]"),
  isBlocked: z.boolean().optional(),
  turnRadius: z.number().optional().describe("Turn radius limit [degrees]"),
});

const InputTopoNode = z.object({
  parentId: z.string().uuid().optional(),
  nodeId: z.string().uuid(),
  nodeUserId: z.string().optional(),
  name: z.string().optional(),
  position: GeoPoint.optional(),
  area: GeoPolygon.optional(),
  line: GeoLineString.optional(),
  nodeType: NodeType.optional(),
  userType: z.string().optional(),
  userProperties: z.record(z.string()).optional(),
  visible: z.boolean().optional(),
  risIndex: z.string().optional(),
  topologyId: z.string().uuid().optional(),
});

const WpConnection = z.object({
  fromId: z.string().uuid(),
  fromUserId: z.string().optional(),
  toId: z.string().uuid(),
  toUserId: z.string().optional(),
  distance: z.number().optional(),
  travelTime: z.number().int().optional(),
  maxLength: z.number().optional(),
  maxBreadth: z.number().optional(),
  maxDraught: z.number().optional(),
  maxHeight: z.number().optional(),
  speedLimit: z.number().optional(),
  isBlocked: z.boolean().optional(),
  turnRadius: z.number().optional(),
  xtdPort: z.number().optional(),
  xtdStarboard: z.number().optional(),
  priority: z.number().int().optional(),
  limits: PathRestrictions.optional(),
});

const WpConnectionList = z.object({
  topologyId: z.string().uuid(),
  topologyUserId: z.string().optional(),
  connections: z.array(WpConnection).optional(),
});

export function registerTopologyTools(server: McpServer): void {
  server.registerTool(
    "get_allowed_topologies",
    {
      description: "Get a list of topologies the current user has access to.",
      inputSchema: {},
    },
    async () => {
      const data = await apiGet("/topology/api/v1/topology/allowed");
      return result(data);
    },
  );

  server.registerTool(
    "topology_allowed_to_view",
    {
      description: "Check whether the current user has view access to the topology with the given LoCode.",
      inputSchema: {
        loCode: z.string().optional().describe("LoCode of the topology"),
      },
    },
    async (params) => {
      const data = await apiGet(`/topology/api/v1/topology/allowedtoview${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "topology_allowed_to_modify",
    {
      description: "Check whether the current user has modify access to the topology with the given LoCode.",
      inputSchema: {
        loCode: z.string().optional().describe("LoCode of the topology"),
      },
    },
    async (params) => {
      const data = await apiGet(`/topology/api/v1/topology/allowedtomodify${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "topology_allowed_to_operate",
    {
      description: "Check whether the current user has operate access to the topology with the given LoCode.",
      inputSchema: {
        loCode: z.string().optional().describe("LoCode of the topology"),
      },
    },
    async (params) => {
      const data = await apiGet(`/topology/api/v1/topology/allowedtooperate${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_topology_shortest_path",
    {
      description: "Get the shortest route path between two topology nodes, with optional vessel constraints and mandatory/avoid waypoints.",
      inputSchema: {
        wpFrom: z.string().uuid().describe("Start node UUID"),
        wpTo: z.string().uuid().describe("End node UUID"),
        wpMandatory: z.array(z.string().uuid()).optional().describe("Node UUIDs that must be included in the route"),
        wpAvoid: z.string().uuid().optional().describe("Node UUID to exclude from the route"),
        draught: z.number().optional().describe("Max draught [meters]"),
        height: z.number().optional().describe("Max height [meters]"),
        breadth: z.number().optional().describe("Max breadth [meters]"),
        length: z.number().optional().describe("Max length [meters]"),
        speedlimit: z.number().optional().describe("Max speed limit [knots]"),
        turnradius: z.number().optional().describe("Max turn radius [degrees]"),
        format: z.enum(["Json", "GeoJson"]).default("GeoJson").describe("Output format"),
      },
    },
    async (params) => {
      const data = await apiGet(`/topology/api/v1/topology/shortestpath${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_topology_tree",
    {
      description: "Get the topology node tree for a given topology (port area).",
      inputSchema: {
        topologyId: z.string().uuid().describe("Top-node topology UUID"),
      },
    },
    async (params) => {
      const data = await apiGet(`/topology/api/v1/topology/topologytree${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_topology_geojson",
    {
      description: "Get the topology tree as GeoJSON objects.",
      inputSchema: {
        topologyId: z.string().uuid().describe("Topology UUID"),
      },
    },
    async (params) => {
      const data = await apiGet(`/topology/api/v1/topology/topologygeojson${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_topology_nodes_by_type",
    {
      description: "Get topology nodes filtered by node type.",
      inputSchema: {
        nodeType: NodeType.describe("Node type to filter on"),
        topologyId: z.string().uuid().optional().describe("Topology UUID to scope the query"),
      },
    },
    async (params) => {
      const data = await apiGet(`/topology/api/v1/topology/topologynodesbytype${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_topology_nodes_with_restrictions",
    {
      description: "Get all topology nodes that have path restrictions set.",
      inputSchema: {
        topologyId: z.string().uuid().describe("Topology UUID"),
      },
    },
    async (params) => {
      const data = await apiGet(`/topology/api/v1/topology/topologynodeswithrestrictions${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_topology_wp_connections_with_restrictions",
    {
      description: "Get all waypoint connections that have path restrictions set.",
      inputSchema: {
        topologyId: z.string().uuid().describe("Topology UUID"),
      },
    },
    async (params) => {
      const data = await apiGet(`/topology/api/v1/topology/topologywpconnectionswithrestrictions${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_topology_node_one_way_paths",
    {
      description: "Get topology node paths that have one-way traffic defined.",
      inputSchema: {
        topologyId: z.string().uuid().describe("Topology UUID"),
      },
    },
    async (params) => {
      const data = await apiGet(`/topology/api/v1/topology/topologynodeonewaypaths${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_topology_nodes_without_connection",
    {
      description: "Get topology nodes that have no waypoint connections.",
      inputSchema: {
        topologyId: z.string().uuid().describe("Topology UUID"),
      },
    },
    async (params) => {
      const data = await apiGet(`/topology/api/v1/topology/topologynodeswithoutconnection${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_topology_nodes_without_connection_count",
    {
      description: "Get the count of topology nodes that have no waypoint connections.",
      inputSchema: {
        topologyId: z.string().uuid().optional().describe("Topology UUID"),
      },
    },
    async (params) => {
      const data = await apiGet(`/topology/api/v1/topology/topologynodeswithoutconnectioncount${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_topology_wp_connections",
    {
      description: "Get waypoint connections for all port areas.",
      inputSchema: {},
    },
    async () => {
      const data = await apiGet("/topology/api/v1/topology/topologywpconnections");
      return result(data);
    },
  );

  server.registerTool(
    "get_single_topology_wp_connections",
    {
      description: "Get waypoint connections for a specific topology.",
      inputSchema: {
        topologyId: z.string().uuid().describe("Topology UUID"),
      },
    },
    async (params) => {
      const data = await apiGet(`/topology/api/v1/topology/singletopologywpconnections${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "create_topology",
    {
      description: "Create the top-node of a new topology and set up authorization resources.",
      inputSchema: InputTopoNode.shape,
    },
    async (body) => {
      const data = await apiPost("/topology/api/v1/topology/create", body);
      return result(data);
    },
  );

  server.registerTool(
    "write_topology_tree",
    {
      description: "Write an entire topology tree to the database.",
      inputSchema: {
        replace: z.boolean().optional().default(false).describe("Replace existing topology if it exists"),
        tree: z.object({
          nodeId: z.string().uuid(),
          topologyId: z.string().uuid(),
          parentNodeId: z.string().uuid().optional(),
          nodeUserId: z.string().optional(),
          name: z.string().optional(),
          nodeType: NodeType.optional(),
          userType: z.string().optional(),
          userProperties: z.record(z.string()).optional(),
          visible: z.boolean().optional(),
          risIndex: z.string().optional(),
          limits: PathRestrictions.optional(),
          topoSubNodes: z.array(z.unknown()).optional().describe("Child TopologyNode objects"),
        }).describe("TopologyNode tree to write"),
      },
    },
    async ({ replace, tree }) => {
      const data = await apiPost(`/topology/api/v1/topology/topologywritetree${buildQuery({ replace })}`, tree);
      return result(data);
    },
  );

  server.registerTool(
    "write_topology_wp_connections",
    {
      description: "Write waypoint connections for a topology to the database, replacing the existing set.",
      inputSchema: WpConnectionList.shape,
    },
    async (body) => {
      const data = await apiPost("/topology/api/v1/topology/topologywritewpconnections", body);
      return result(data);
    },
  );

  server.registerTool(
    "delete_topology_tree",
    {
      description: "Delete a topology tree from the database.",
      inputSchema: {
        topologyId: z.string().uuid().describe("Topology UUID to delete"),
      },
    },
    async ({ topologyId }) => {
      await apiDelete(`/topology/api/v1/topology/topologydeletetree${buildQuery({ topologyId })}`);
      return result({ success: true, message: `Topology ${topologyId} deleted.` });
    },
  );

  server.registerTool(
    "set_topology_node",
    {
      description: "Set basic info of a single topology node.",
      inputSchema: InputTopoNode.shape,
    },
    async (body) => {
      const data = await apiPut("/topology/api/v1/topology/toposetnode", body);
      return result(data);
    },
  );

  server.registerTool(
    "set_topology_node_area",
    {
      description: "Set the area polygon of a topology node.",
      inputSchema: {
        nodeId: z.string().uuid().describe("Node UUID"),
        polygon: GeoPolygon.describe("GeoJSON Polygon to set as the node area"),
      },
    },
    async ({ nodeId, polygon }) => {
      const data = await apiPut(`/topology/api/v1/topology/toposetnodearea${buildQuery({ nodeId })}`, polygon);
      return result(data);
    },
  );

  server.registerTool(
    "set_topology_node_properties",
    {
      description: "Set user-defined properties on a topology node.",
      inputSchema: {
        nodeId: z.string().uuid().describe("Node UUID"),
        userProperties: z.record(z.string()).describe("Key-value properties to set"),
      },
    },
    async ({ nodeId, userProperties }) => {
      const data = await apiPut(`/topology/api/v1/topology/toposetnodeproperties${buildQuery({ nodeId })}`, { userProperties });
      return result(data);
    },
  );

  server.registerTool(
    "set_topology_node_restrictions",
    {
      description: "Set path restrictions on a topology node.",
      inputSchema: {
        nodeId: z.string().uuid().describe("Node UUID"),
        ...PathRestrictions.shape,
      },
    },
    async ({ nodeId, ...restrictions }) => {
      const data = await apiPut(`/topology/api/v1/topology/toposetnoderestrictions${buildQuery({ nodeId })}`, restrictions);
      return result(data);
    },
  );

  server.registerTool(
    "set_topology_wp_connection_restrictions",
    {
      description: "Set path restrictions on a waypoint connection between two nodes.",
      inputSchema: {
        fromId: z.string().uuid().describe("Start node UUID"),
        toId: z.string().uuid().describe("End node UUID"),
        ...PathRestrictions.shape,
      },
    },
    async ({ fromId, toId, ...restrictions }) => {
      const data = await apiPut(`/topology/api/v1/topology/toposetwpconnectionrestrictions${buildQuery({ fromId, toId })}`, restrictions);
      return result(data);
    },
  );

  server.registerTool(
    "get_template_path_names",
    {
      description: "Get the names of all available template paths.",
      inputSchema: {},
    },
    async () => {
      const data = await apiGet("/topology/api/v1/topology/templatepathnames");
      return result(data);
    },
  );

  server.registerTool(
    "get_template_path",
    {
      description: "Get the waypoints of a named template path.",
      inputSchema: {
        name: z.string().describe("Template path name"),
        format: z.enum(["Json", "GeoJson"]).default("GeoJson").describe("Output format"),
      },
    },
    async (params) => {
      const data = await apiGet(`/topology/api/v1/topology/templatepath${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "add_template_path",
    {
      description: "Save a route path as a named template.",
      inputSchema: {
        pathName: z.string().describe("Name for the template path"),
        force: z.boolean().optional().default(false).describe("Overwrite if a template with this name already exists"),
        wayPoints: z.array(z.object({
          id: z.string().uuid().optional(),
          externalId: z.string().optional(),
          name: z.string().optional(),
          nodeType: NodeType.optional(),
          position: GeoPoint.optional(),
          userProperties: z.record(z.string()).optional(),
          legDistance: z.number().optional(),
          legTravelTime: z.number().int().optional(),
          legXtdPort: z.number().optional(),
          legXtdStarboard: z.number().optional(),
          legLimits: PathRestrictions.optional(),
        })).optional().describe("Route waypoints"),
      },
    },
    async ({ pathName, force, ...routePath }) => {
      const data = await apiPost(`/topology/api/v1/topology/addtemplatepath${buildQuery({ pathName, force })}`, routePath);
      return result(data);
    },
  );

  server.registerTool(
    "delete_template_path",
    {
      description: "Delete a named template path.",
      inputSchema: {
        name: z.string().describe("Template path name to delete"),
      },
    },
    async (params) => {
      const data = await apiGet(`/topology/api/v1/topology/deletetemplatepath${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_failed_replications",
    {
      description: "Get failed replication log entries (useful in High Availability configurations).",
      inputSchema: {
        onlyFailures: z.boolean().optional().default(true),
        specificDateTime: z.string().optional().describe("ISO 8601 date-time to scope the query"),
      },
    },
    async (params) => {
      const data = await apiGet(`/topology/api/v1/topology/failedreplications${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_failed_replication_count",
    {
      description: "Get the count of failed replications (useful in High Availability configurations).",
      inputSchema: {
        onlyFailures: z.boolean().optional().default(true),
        specificDateTime: z.string().optional().describe("ISO 8601 date-time to scope the query"),
      },
    },
    async (params) => {
      const data = await apiGet(`/topology/api/v1/topology/failedreplicationcount${buildQuery(params)}`);
      return result(data);
    },
  );
}
