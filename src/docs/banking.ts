const idempotentSecurity = [{ BearerAuth: [], IdempotencyKey: [] }];

const operationRequest = {
  required: true,
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/MoneyOperationRequest" },
    },
  },
};

const operationResponse = {
  description: "Financial operation committed",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/OperationEnvelope" },
    },
  },
};

const financialOperationErrors = {
  "400": { $ref: "#/components/responses/ValidationError" },
  "401": { $ref: "#/components/responses/Unauthorized" },
  "404": { $ref: "#/components/responses/NotFound" },
  "409": { $ref: "#/components/responses/Conflict" },
  "500": { $ref: "#/components/responses/ServerError" },
  "503": { $ref: "#/components/responses/ServiceUnavailable" },
};

export const bankingPaths = {
  "/banking/deposit": {
    post: {
      tags: ["Banking"],
      summary: "Deposit money",
      description:
        "Deposits into an account owned by the authenticated customer. The ledger entries and idempotency result commit atomically.",
      security: idempotentSecurity,
      parameters: [
        {
          $ref: "#/components/parameters/IdempotencyKey",
        },
      ],
      requestBody: operationRequest,
      responses: {
        "201": operationResponse,
        ...financialOperationErrors,
      },
    },
  },
  "/banking/withdraw": {
    post: {
      tags: ["Banking"],
      summary: "Withdraw money",
      description:
        "Withdraws from an account owned by the authenticated customer. Insufficient funds return 409.",
      security: idempotentSecurity,
      parameters: [{ $ref: "#/components/parameters/IdempotencyKey" }],
      requestBody: operationRequest,
      responses: {
        "201": operationResponse,
        ...financialOperationErrors,
      },
    },
  },
  "/banking/transfer": {
    post: {
      tags: ["Banking"],
      summary: "Transfer money between owned accounts",
      description:
        "Both source and destination accounts must belong to the authenticated customer. All four ledger entries and the idempotency result commit atomically.",
      security: idempotentSecurity,
      parameters: [{ $ref: "#/components/parameters/IdempotencyKey" }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/TransferRequest" },
          },
        },
      },
      responses: {
        "201": operationResponse,
        ...financialOperationErrors,
      },
    },
  },
  "/banking/{accountNumber}/balance": {
    get: {
      tags: ["Banking"],
      summary: "Get an owned account's ledger-derived balance",
      parameters: [
        {
          name: "accountNumber",
          in: "path",
          required: true,
          schema: { type: "string", maxLength: 20 },
        },
        {
          name: "at",
          in: "query",
          required: false,
          description: "Return the balance reconstructed at this timestamp.",
          schema: { type: "string", format: "date-time" },
        },
      ],
      responses: {
        "200": {
          description: "Balance calculated from ledger entries",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/BalanceEnvelope" },
            },
          },
        },
        "400": { $ref: "#/components/responses/ValidationError" },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "404": { $ref: "#/components/responses/NotFound" },
        "503": { $ref: "#/components/responses/ServiceUnavailable" },
      },
    },
  },
  "/banking/{accountNumber}/history": {
    get: {
      tags: ["Banking"],
      summary: "Get an owned account's transaction history",
      parameters: [
        {
          name: "accountNumber",
          in: "path",
          required: true,
          schema: { type: "string", maxLength: 20 },
        },
        {
          name: "page",
          in: "query",
          schema: { type: "integer", minimum: 1, default: 1 },
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        },
        {
          name: "sort",
          in: "query",
          schema: { type: "string", enum: ["asc", "desc"], default: "desc" },
        },
      ],
      responses: {
        "200": {
          description: "Paginated ledger transaction history",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/HistoryEnvelope" },
            },
          },
        },
        "400": { $ref: "#/components/responses/ValidationError" },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "404": { $ref: "#/components/responses/NotFound" },
        "503": { $ref: "#/components/responses/ServiceUnavailable" },
      },
    },
  },
};
