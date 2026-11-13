const successEnvelope = (data: Record<string, unknown>) => ({
  type: "object",
  required: ["success", "data"],
  properties: {
    success: { type: "boolean", enum: [true] },
    data,
  },
});

export const schemas = {
  ErrorResponse: {
    type: "object",
    required: ["success", "message"],
    properties: {
      success: { type: "boolean", enum: [false] },
      message: { type: "string" },
      errors: {
        type: "array",
        items: {
          type: "object",
          required: ["field", "message"],
          properties: {
            field: { type: "string" },
            message: { type: "string" },
          },
        },
      },
    },
  },
  CreateAccountRequest: {
    type: "object",
    required: ["customerId", "accountNumber", "accountType"],
    properties: {
      customerId: { type: "string", format: "uuid" },
      accountNumber: { type: "string", minLength: 1, maxLength: 20 },
      accountType: { type: "string", enum: ["SAVINGS", "CURRENT"] },
    },
  },
  MoneyOperationRequest: {
    type: "object",
    required: ["accountNumber", "amount"],
    properties: {
      accountNumber: { type: "string", minLength: 1, maxLength: 20 },
      amount: {
        type: "string",
        pattern: "^\\d+(\\.\\d{1,2})?$",
        example: "1000.00",
      },
    },
  },
  TransferRequest: {
    type: "object",
    required: ["fromAccountNumber", "toAccountNumber", "amount"],
    properties: {
      fromAccountNumber: { type: "string", minLength: 1, maxLength: 20 },
      toAccountNumber: { type: "string", minLength: 1, maxLength: 20 },
      amount: {
        type: "string",
        pattern: "^\\d+(\\.\\d{1,2})?$",
        example: "1000.00",
      },
      description: { type: "string", maxLength: 255 },
    },
  },
  Account: {
    type: "object",
    required: [
      "id",
      "accountNumber",
      "customerId",
      "accountType",
      "status",
      "createdAt",
    ],
    properties: {
      id: { type: "string", format: "uuid" },
      accountNumber: { type: "string" },
      customerId: { type: "string", format: "uuid" },
      accountType: { type: "string", enum: ["SAVINGS", "CURRENT"] },
      status: { type: "string", enum: ["ACTIVE", "BLOCKED", "CLOSED"] },
      createdAt: { type: "string", format: "date-time" },
    },
  },
  AccountEnvelope: successEnvelope({
    $ref: "#/components/schemas/Account",
  }),
  AccountListEnvelope: successEnvelope({
    type: "array",
    items: { $ref: "#/components/schemas/Account" },
  }),
  OperationEnvelope: successEnvelope({
    type: "object",
    required: ["transactionId", "reference"],
    properties: {
      transactionId: { type: "string", format: "uuid" },
      reference: { type: "string", format: "uuid" },
    },
  }),
  BalanceEnvelope: successEnvelope({
    type: "object",
    required: ["accountNumber", "balance"],
    properties: {
      accountNumber: { type: "string" },
      balance: { type: "string", example: "5500.00" },
      asOf: { type: "string", format: "date-time" },
    },
  }),
  HistoryEnvelope: successEnvelope({
    type: "object",
    required: ["transactions", "pagination"],
    properties: {
      transactions: {
        type: "array",
        items: {
          type: "object",
          required: [
            "transactionId",
            "reference",
            "entryType",
            "amount",
            "description",
            "createdAt",
          ],
          properties: {
            transactionId: { type: "string", format: "uuid" },
            reference: { type: "string", format: "uuid" },
            entryType: { type: "string", enum: ["DEBIT", "CREDIT"] },
            amount: { type: "string" },
            description: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },
      },
      pagination: {
        type: "object",
        required: ["page", "limit", "totalRecords", "totalPages"],
        properties: {
          page: { type: "integer" },
          limit: { type: "integer" },
          totalRecords: { type: "integer" },
          totalPages: { type: "integer" },
        },
      },
    },
  }),
  TransactionDetailsEnvelope: successEnvelope({
    type: "object",
    required: [
      "transactionId",
      "reference",
      "type",
      "createdAt",
      "entries",
      "debitEntries",
      "creditEntries",
    ],
    properties: {
      transactionId: { type: "string", format: "uuid" },
      reference: { type: "string", format: "uuid" },
      type: { type: "string", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      entries: { type: "array", items: { type: "object" } },
      debitEntries: { type: "array", items: { type: "object" } },
      creditEntries: { type: "array", items: { type: "object" } },
    },
  }),
};
