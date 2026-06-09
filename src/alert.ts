import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, apiDelete, buildQuery, result } from "./helpers.js";

const AlertLevel = z.enum(["Unspecified", "Info", "Warning", "Alarm"]);

export function registerAlertTools(server: McpServer): void {
  server.registerTool(
    "get_alerts",
    {
      description: "Get a list of alerts with optional filters and cursor-based pagination.",
      inputSchema: {
        from: z.string().optional().describe("ISO 8601 date-time — filter alerts from this time"),
        to: z.string().optional().describe("ISO 8601 date-time — filter alerts to this time"),
        includeRemoved: z.boolean().optional().default(false).describe("Include removed alerts (default false)"),
        categories: z.string().optional().describe("Filter by categories"),
        after: z.string().uuid().optional().describe("Cursor for pagination — alert ID to start after"),
      },
    },
    async (params) => {
      const data = await apiGet(`/alert/api/v1/alert${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_alert",
    {
      description: "Get an alert by its UUID.",
      inputSchema: {
        id: z.string().uuid().describe("Alert UUID"),
      },
    },
    async ({ id }) => {
      const data = await apiGet(`/alert/api/v1/alert/${id}`);
      return result(data);
    },
  );

  server.registerTool(
    "create_alert",
    {
      description: "Create a new alert.",
      inputSchema: {
        typeId: z.string().uuid().describe("Alert type UUID"),
        alertLevel: AlertLevel,
        acknowledged: z.boolean(),
        autoRemove: z.boolean(),
        properties: z.array(z.object({
          name: z.string().optional(),
          value: z.string().optional(),
          displayValue: z.string().optional(),
        })).optional().describe("Key-value properties"),
        sectors: z.array(z.string().uuid()).optional().describe("Sector UUIDs"),
        urn: z.string().optional(),
      },
    },
    async (body) => {
      const data = await apiPost("/alert/api/v1/alert", body);
      return result(data);
    },
  );

  server.registerTool(
    "delete_alert",
    {
      description: "Delete an alert by its UUID.",
      inputSchema: {
        id: z.string().uuid().describe("Alert UUID"),
      },
    },
    async ({ id }) => {
      await apiDelete(`/alert/api/v1/alert/${id}`);
      return result({ success: true, message: `Alert ${id} deleted.` });
    },
  );

  server.registerTool(
    "add_alert_comment",
    {
      description: "Add a comment to an alert.",
      inputSchema: {
        id: z.string().uuid().describe("Alert UUID"),
        comment: z.string().optional().describe("Comment text"),
      },
    },
    async ({ id, comment }) => {
      const data = await apiPost(`/alert/api/v1/alert/${id}/comments${buildQuery({ comment })}`, undefined);
      return result(data);
    },
  );

  server.registerTool(
    "set_alert_acknowledged",
    {
      description: "Set the acknowledged flag on an alert.",
      inputSchema: {
        id: z.string().uuid().describe("Alert UUID"),
        value: z.boolean().describe("Acknowledged state"),
      },
    },
    async ({ id, value }) => {
      const data = await apiPut(`/alert/api/v1/alert/${id}/acknowledged/${value}`, undefined);
      return result(data);
    },
  );

  server.registerTool(
    "set_alert_level",
    {
      description: "Set the alert level on an alert.",
      inputSchema: {
        id: z.string().uuid().describe("Alert UUID"),
        level: AlertLevel,
      },
    },
    async ({ id, level }) => {
      const data = await apiPut(`/alert/api/v1/alert/${id}/alertlevel/${level}`, undefined);
      return result(data);
    },
  );

  server.registerTool(
    "set_alert_autoremove",
    {
      description: "Set the autoremove flag on an alert.",
      inputSchema: {
        id: z.string().uuid().describe("Alert UUID"),
        value: z.boolean().describe("Autoremove state"),
      },
    },
    async ({ id, value }) => {
      const data = await apiPut(`/alert/api/v1/alert/${id}/autoremove/${value}`, undefined);
      return result(data);
    },
  );

  server.registerTool(
    "get_alert_types",
    {
      description: "Get all alert types.",
      inputSchema: {},
    },
    async () => {
      const data = await apiGet("/alert/api/v1/alert/type");
      return result(data);
    },
  );

  server.registerTool(
    "get_alert_type",
    {
      description: "Get an alert type by its UUID.",
      inputSchema: {
        id: z.string().uuid().describe("Alert type UUID"),
      },
    },
    async ({ id }) => {
      const data = await apiGet(`/alert/api/v1/alert/type/${id}`);
      return result(data);
    },
  );

  server.registerTool(
    "create_alert_type",
    {
      description: "Create a new alert type.",
      inputSchema: {
        formatString: z.string().min(1).describe("Message format string"),
        shortFormatString: z.string().min(1).describe("Short message format string"),
        alertLevel: AlertLevel,
        autoRemove: z.boolean(),
        categories: z.array(z.string()).optional(),
        groups: z.array(z.string().uuid()).optional().describe("Access group UUIDs"),
        sectors: z.array(z.string().uuid()).optional(),
        global: z.boolean().optional(),
        urnNamespace: z.string().optional(),
      },
    },
    async (body) => {
      const data = await apiPost("/alert/api/v1/alert/type", body);
      return result(data);
    },
  );

  server.registerTool(
    "get_alert_type_groups",
    {
      description: "Get access groups for an alert type.",
      inputSchema: {
        id: z.string().uuid().describe("Alert type UUID"),
      },
    },
    async ({ id }) => {
      const data = await apiGet(`/alert/api/v1/alert/type/${id}/groups`);
      return result(data);
    },
  );

  server.registerTool(
    "set_alert_type_groups",
    {
      description: "Set access groups for an alert type.",
      inputSchema: {
        id: z.string().uuid().describe("Alert type UUID"),
        groups: z.array(z.string().uuid()).describe("Group UUIDs to assign"),
      },
    },
    async ({ id, groups }) => {
      const data = await apiPut(`/alert/api/v1/alert/type/${id}/groups`, groups);
      return result(data);
    },
  );

  // ── Cross-service enrichment ──────────────────────────────────────────────

  server.registerTool(
    "get_alert_with_type",
    {
      description: "Get an alert by UUID and enrich it with its full alert type details.",
      inputSchema: {
        id: z.string().uuid().describe("Alert UUID"),
      },
    },
    async ({ id }) => {
      const alert = await apiGet(`/alert/api/v1/alert/${id}`) as Record<string, unknown> | null;
      if (!alert) return result(null);

      const typeId = alert.typeId as string | undefined;
      let type = null;
      if (typeId) {
        try {
          type = await apiGet(`/alert/api/v1/alert/type/${typeId}`);
        } catch {
          type = { error: `Could not load alert type for id ${typeId}` };
        }
      }

      return result({ alert, type });
    },
  );

  server.registerTool(
    "get_alert_replay_snapshot",
    {
      description: "Get a snapshot of all active alerts at a specific timestamp. Alerts created/modified more than 24 hours before the timestamp are excluded.",
      inputSchema: {
        timestamp: z.string().describe("ISO 8601 date-time for the snapshot"),
      },
    },
    async ({ timestamp }) => {
      const data = await apiGet(`/alert/api/v1/alert/replay/snapshot${buildQuery({ timestamp })}`);
      return result(data);
    },
  );
}
