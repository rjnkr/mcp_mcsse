import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, apiPatch, apiDelete, buildQuery, result } from "./helpers.js";

const MessageType = z.enum([
  "Undefined",
  "AddressedSrm",
  "BroadcastSrm",
  "AddressedBinaryText",
  "BroadcastBinaryText",
  "AddressedClearanceTime",
  "AddressedRtaLockBridgeTerminal",
  "AddressedEtaLockBridgeTerminal",
]);

const BroadcastArea = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.array(z.number()))),
  bbox: z.array(z.number()).optional(),
}).describe("GeoJSON Polygon broadcast area (counter-clockwise, min 4 points). Only used for BroadcastBinaryText or BroadcastSrm.");

const Draft = z.object({
  addressedRecipients: z.array(z.number().int()).optional().describe("MMSI list of addressed recipients"),
  content: z.string().optional().describe("Message text content"),
  isChineseText: z.boolean().optional().describe("Set to true if content contains Chinese characters"),
  messageType: MessageType.optional(),
  encryptionLink: z.string().uuid().optional().describe("Encryption link UUID configured on the mailbox"),
  comment: z.string().optional().describe("Arbitrary metadata — not transmitted with the message"),
  binaryContent: z.unknown().optional().describe("Binary function message content (ClearanceTime, RTA, etc.)"),
  broadcastArea: BroadcastArea.optional(),
  applicationAckRequested: z.boolean().optional().describe("Request application acknowledgement (addressed messages only)"),
});

export function registerAisMailTools(server: McpServer): void {
  server.registerTool(
    "get_mailboxes",
    {
      description: "Get all AIS mailboxes the current user has access to.",
      inputSchema: {},
    },
    async () => {
      const data = await apiGet("/aismail/api/v2/mail/mailboxes");
      return result(data);
    },
  );

  server.registerTool(
    "get_mailbox",
    {
      description: "Get a specific AIS mailbox by its UUID.",
      inputSchema: {
        mailboxId: z.string().uuid().describe("Mailbox UUID"),
      },
    },
    async ({ mailboxId }) => {
      const data = await apiGet(`/aismail/api/v2/mail/mailboxes/${mailboxId}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_mailbox_labels",
    {
      description: "Get all available labels for a mailbox.",
      inputSchema: {
        mailboxId: z.string().uuid().describe("Mailbox UUID"),
      },
    },
    async ({ mailboxId }) => {
      const data = await apiGet(`/aismail/api/v2/mail/mailboxes/${mailboxId}/labels`);
      return result(data);
    },
  );

  server.registerTool(
    "get_messages",
    {
      description: "Get messages from a mailbox with optional label, pagination, and filter. Sort order depends on label: inbox=receivedDateTime, drafts/outbox=modifiedDateTime, sent=sentDateTime, none=createdDateTime.",
      inputSchema: {
        mailboxId: z.string().uuid().describe("Mailbox UUID"),
        label: z.string().optional().describe("Filter by label (e.g. inbox, drafts, outbox, sent)"),
        offSet: z.number().int().optional().describe("Pagination offset"),
        limit: z.number().int().optional().describe("Max number of messages to return"),
        modifiedWithinMinutes: z.number().int().optional().describe("Only messages modified within this many minutes"),
        isTrashed: z.boolean().optional().describe("Filter by trashed state"),
      },
    },
    async ({ mailboxId, ...params }) => {
      const data = await apiGet(`/aismail/api/v2/mail/mailboxes/${mailboxId}/messages${buildQuery(params)}`);
      return result(data);
    },
  );

  server.registerTool(
    "get_message",
    {
      description: "Get a specific AIS message by its UUID.",
      inputSchema: {
        mailboxId: z.string().uuid().describe("Mailbox UUID"),
        messageId: z.string().uuid().describe("Message UUID"),
      },
    },
    async ({ mailboxId, messageId }) => {
      const data = await apiGet(`/aismail/api/v2/mail/mailboxes/${mailboxId}/messages/${messageId}`);
      return result(data);
    },
  );

  server.registerTool(
    "patch_message",
    {
      description: "Update properties of an existing message. All messages: isRead, isTrashed, labels. Draft-only: isChineseText, content, addressedRecipients, encryptionLink, messageType, comment, binaryContent.",
      inputSchema: {
        mailboxId: z.string().uuid().describe("Mailbox UUID"),
        messageId: z.string().uuid().describe("Message UUID"),
        patch: z.record(z.unknown()).describe("Fields to update"),
      },
    },
    async ({ mailboxId, messageId, patch }) => {
      const data = await apiPatch(`/aismail/api/v2/mail/mailboxes/${mailboxId}/messages/${messageId}`, patch);
      return result(data);
    },
  );

  server.registerTool(
    "delete_message",
    {
      description: "Delete a specific message from a mailbox.",
      inputSchema: {
        mailboxId: z.string().uuid().describe("Mailbox UUID"),
        messageId: z.string().uuid().describe("Message UUID"),
      },
    },
    async ({ mailboxId, messageId }) => {
      await apiDelete(`/aismail/api/v2/mail/mailboxes/${mailboxId}/messages/${messageId}`);
      return result({ success: true, message: `Message ${messageId} deleted.` });
    },
  );

  server.registerTool(
    "create_draft",
    {
      description: "Create a new draft message in the specified mailbox without sending it.",
      inputSchema: {
        mailboxId: z.string().uuid().describe("Mailbox UUID"),
        ...Draft.shape,
      },
    },
    async ({ mailboxId, ...draft }) => {
      const data = await apiPost(`/aismail/api/v2/mail/mailboxes/${mailboxId}/messages`, draft);
      return result(data);
    },
  );

  server.registerTool(
    "replace_draft",
    {
      description: "Replace the full content of an existing draft message.",
      inputSchema: {
        mailboxId: z.string().uuid().describe("Mailbox UUID"),
        messageId: z.string().uuid().describe("Draft message UUID"),
        ...Draft.shape,
      },
    },
    async ({ mailboxId, messageId, ...draft }) => {
      const data = await apiPut(`/aismail/api/v2/mail/mailboxes/${mailboxId}/messages/${messageId}`, draft);
      return result(data);
    },
  );

  server.registerTool(
    "send_draft",
    {
      description: "Send an existing draft message to its recipients. Poll get_message to track the send state.",
      inputSchema: {
        mailboxId: z.string().uuid().describe("Mailbox UUID"),
        messageId: z.string().uuid().describe("Draft message UUID to send"),
        requireApplicationAck: z.boolean().optional().describe("Override mailbox default for application acknowledgement"),
      },
    },
    async ({ mailboxId, messageId, requireApplicationAck }) => {
      const data = await apiPost(
        `/aismail/api/v2/mail/mailboxes/${mailboxId}/messages/${messageId}/send${buildQuery({ requireApplicationAck })}`,
        undefined,
      );
      return result(data);
    },
  );

  server.registerTool(
    "create_and_send_message",
    {
      description: "Create a new draft and immediately send it in a single operation.",
      inputSchema: {
        mailboxId: z.string().uuid().describe("Mailbox UUID"),
        requireApplicationAck: z.boolean().optional().describe("Override mailbox default for application acknowledgement"),
        ...Draft.shape,
      },
    },
    async ({ mailboxId, requireApplicationAck, ...draft }) => {
      const data = await apiPost(
        `/aismail/api/v2/mail/mailboxes/${mailboxId}/messages/send${buildQuery({ requireApplicationAck })}`,
        draft,
      );
      return result(data);
    },
  );

  server.registerTool(
    "trash_message",
    {
      description: "Mark a message as trashed.",
      inputSchema: {
        mailboxId: z.string().uuid().describe("Mailbox UUID"),
        messageId: z.string().uuid().describe("Message UUID"),
      },
    },
    async ({ mailboxId, messageId }) => {
      const data = await apiPost(`/aismail/api/v2/mail/mailboxes/${mailboxId}/messages/${messageId}/trash`, undefined);
      return result(data);
    },
  );

  server.registerTool(
    "untrash_message",
    {
      description: "Remove the trash flag from a message.",
      inputSchema: {
        mailboxId: z.string().uuid().describe("Mailbox UUID"),
        messageId: z.string().uuid().describe("Message UUID"),
      },
    },
    async ({ mailboxId, messageId }) => {
      const data = await apiPost(`/aismail/api/v2/mail/mailboxes/${mailboxId}/messages/${messageId}/untrash`, undefined);
      return result(data);
    },
  );

  server.registerTool(
    "mark_message_read",
    {
      description: "Mark a message as read.",
      inputSchema: {
        mailboxId: z.string().uuid().describe("Mailbox UUID"),
        messageId: z.string().uuid().describe("Message UUID"),
      },
    },
    async ({ mailboxId, messageId }) => {
      const data = await apiPost(`/aismail/api/v2/mail/mailboxes/${mailboxId}/messages/${messageId}/read`, undefined);
      return result(data);
    },
  );

  server.registerTool(
    "mark_message_unread",
    {
      description: "Mark a message as unread.",
      inputSchema: {
        mailboxId: z.string().uuid().describe("Mailbox UUID"),
        messageId: z.string().uuid().describe("Message UUID"),
      },
    },
    async ({ mailboxId, messageId }) => {
      const data = await apiPost(`/aismail/api/v2/mail/mailboxes/${mailboxId}/messages/${messageId}/unread`, undefined);
      return result(data);
    },
  );
}
