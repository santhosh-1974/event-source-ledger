const authWithIdempotency = [{ BearerAuth: [], IdempotencyKey: [] }];

const scheduleIdParameter = {
  name: "scheduleId",
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" },
};

export const scheduledTransferPaths = {
  "/scheduled-transfers": {
    get: {
      tags: ["Scheduled Transfers"],
      summary: "List scheduled transfers",
      responses: {
        "200": { description: "Schedules owned by the authenticated customer" },
        "401": { $ref: "#/components/responses/Unauthorized" },
      },
    },
    post: {
      tags: ["Scheduled Transfers"],
      summary: "Create a scheduled or recurring transfer",
      description:
        "Schedules use UTC. Weekly and monthly recurrences retain their original UTC time; a monthly date beyond a month's length is clamped to that month's last day.",
      security: authWithIdempotency,
      parameters: [{ $ref: "#/components/parameters/IdempotencyKey" }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: [
                "fromAccountNumber",
                "beneficiaryId",
                "amount",
                "frequency",
                "startsAt",
              ],
              properties: {
                fromAccountNumber: { type: "string", maxLength: 20 },
                beneficiaryId: { type: "string", format: "uuid" },
                amount: { type: "string", pattern: "^\\d{1,16}(\\.\\d{1,2})?$" },
                description: { type: "string", maxLength: 255 },
                frequency: {
                  type: "string",
                  enum: ["ONCE", "WEEKLY", "MONTHLY"],
                },
                startsAt: { type: "string", format: "date-time" },
              },
            },
          },
        },
      },
      responses: {
        "201": { description: "Schedule created" },
        "400": { $ref: "#/components/responses/ValidationError" },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "404": { $ref: "#/components/responses/NotFound" },
        "409": { $ref: "#/components/responses/Conflict" },
      },
    },
  },
  "/scheduled-transfers/{scheduleId}/occurrences": {
    get: {
      tags: ["Scheduled Transfers"],
      summary: "List recent execution occurrences",
      parameters: [scheduleIdParameter],
      responses: {
        "200": { description: "Up to 500 most recent occurrences" },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "404": { $ref: "#/components/responses/NotFound" },
      },
    },
  },
  "/scheduled-transfers/{scheduleId}/occurrences/{occurrenceId}/retry": {
    post: {
      tags: ["Scheduled Transfers"],
      summary: "Explicitly retry a failed occurrence",
      description:
        "A retry is idempotent and can be requested only for a failed occurrence. Insufficient-funds failures are not retried automatically.",
      security: authWithIdempotency,
      parameters: [
        scheduleIdParameter,
        {
          name: "occurrenceId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
        { $ref: "#/components/parameters/IdempotencyKey" },
      ],
      responses: {
        "200": { description: "Updated occurrence result" },
        "400": { $ref: "#/components/responses/ValidationError" },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "404": { $ref: "#/components/responses/NotFound" },
        "409": { $ref: "#/components/responses/Conflict" },
      },
    },
  },
  "/scheduled-transfers/{scheduleId}/{action}": {
    post: {
      tags: ["Scheduled Transfers"],
      summary: "Pause, resume, or cancel a schedule",
      parameters: [
        scheduleIdParameter,
        {
          name: "action",
          in: "path",
          required: true,
          schema: { type: "string", enum: ["pause", "resume", "cancel"] },
        },
      ],
      responses: {
        "200": { description: "Updated schedule state" },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "404": { $ref: "#/components/responses/NotFound" },
        "409": { $ref: "#/components/responses/Conflict" },
      },
    },
  },
};
