const authWithIdempotency = [{ BearerAuth: [], IdempotencyKey: [] }];

export const beneficiaryPaths = {
  "/beneficiaries": {
    get: {
      tags: ["Beneficiaries"],
      summary: "List saved beneficiaries",
      description:
        "Returns saved recipient accounts for the authenticated customer. Account numbers are masked.",
      responses: {
        "200": { description: "Owned beneficiary list" },
        "401": { $ref: "#/components/responses/Unauthorized" },
      },
    },
    post: {
      tags: ["Beneficiaries"],
      summary: "Save a recipient account",
      description:
        "Only another customer's active account can be saved. Duplicate and self-owned accounts are rejected.",
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["accountNumber", "displayName"],
              properties: {
                accountNumber: { type: "string", maxLength: 20 },
                displayName: { type: "string", minLength: 1, maxLength: 80 },
              },
            },
          },
        },
      },
      responses: {
        "201": { description: "Recipient saved with a masked account number" },
        "400": { $ref: "#/components/responses/ValidationError" },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "404": { $ref: "#/components/responses/NotFound" },
        "409": { $ref: "#/components/responses/Conflict" },
      },
    },
  },
  "/beneficiaries/{beneficiaryId}": {
    patch: {
      tags: ["Beneficiaries"],
      summary: "Enable or disable a saved beneficiary",
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: "beneficiaryId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["enabled"],
              properties: { enabled: { type: "boolean" } },
            },
          },
        },
      },
      responses: {
        "200": { description: "Updated beneficiary" },
        "400": { $ref: "#/components/responses/ValidationError" },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "404": { $ref: "#/components/responses/NotFound" },
      },
    },
  },
  "/banking/beneficiary-transfers": {
    post: {
      tags: ["Banking"],
      summary: "Transfer to a saved beneficiary",
      description:
        "Only the caller's source account and an active beneficiary may be used. The transfer, ledger entries, outbox event, and idempotency result commit atomically.",
      security: authWithIdempotency,
      parameters: [{ $ref: "#/components/parameters/IdempotencyKey" }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["fromAccountNumber", "beneficiaryId", "amount"],
              properties: {
                fromAccountNumber: { type: "string", maxLength: 20 },
                beneficiaryId: { type: "string", format: "uuid" },
                amount: { type: "string", pattern: "^\\d{1,16}(\\.\\d{1,2})?$" },
                description: { type: "string", maxLength: 255 },
              },
            },
          },
        },
      },
      responses: {
        "201": { $ref: "#/components/responses/TransferCreated" },
        "400": { $ref: "#/components/responses/ValidationError" },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "404": { $ref: "#/components/responses/NotFound" },
        "409": { $ref: "#/components/responses/Conflict" },
      },
    },
  },
};
