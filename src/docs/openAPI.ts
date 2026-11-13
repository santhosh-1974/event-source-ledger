import { schemas } from "./schemas";
import { accountPaths } from "./accounts";
import { bankingPaths } from "./banking";
import { transactionPaths } from "./transaction";
import { beneficiaryPaths } from "./beneficiaries";
import { scheduledTransferPaths } from "./scheduledTransfers";
import { reportPaths } from "./reports";

const errorContent = {
  "application/json": {
    schema: { $ref: "#/components/schemas/ErrorResponse" },
  },
};

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Event-Sourced Ledger Banking Core API",
    version: "1.0.0",
    description:
      "Version 1 of the authenticated Banking Core API. Financial writes use PostgreSQL transactions and ledger-derived balances.",
  },
  servers: [
    {
      url: "http://localhost:4000/api/v1",
      description: "Local API Gateway",
    },
    {
      url: "http://localhost:5000/api/v1",
      description: "Local Banking backend",
    },
  ],
  security: [{ BearerAuth: [] }],
  tags: [
    { name: "Accounts" },
    { name: "Banking" },
    { name: "Transactions" },
    { name: "Beneficiaries" },
    { name: "Scheduled Transfers" },
    { name: "Reports" },
  ],
  components: {
    schemas,
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
      IdempotencyKey: {
        type: "apiKey",
        in: "header",
        name: "Idempotency-Key",
      },
    },
    parameters: {
      IdempotencyKey: {
        name: "Idempotency-Key",
        in: "header",
        required: true,
        description:
          "UUID key used to safely retry a financial operation, schedule creation, or scheduled-occurrence retry.",
        schema: { type: "string", format: "uuid" },
      },
    },
    responses: {
      ValidationError: {
        description: "Invalid request; field details are included when available.",
        content: errorContent,
      },
      Unauthorized: {
        description: "Missing, invalid, or expired bearer token.",
        content: errorContent,
      },
      NotFound: {
        description:
          "Resource is missing or belongs to another customer. Ownership failures are masked as not found.",
        content: errorContent,
      },
      Conflict: {
        description:
          "Business conflict, insufficient funds, or idempotency-key conflict.",
        content: errorContent,
      },
      ServerError: {
        description: "Unexpected Banking Core failure.",
        content: errorContent,
      },
      ServiceUnavailable: {
        description: "Banking Core is unavailable through the Gateway.",
        content: errorContent,
      },
      TransferCreated: {
        description: "Financial operation committed",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/OperationEnvelope" },
          },
        },
      },
    },
  },
  paths: {
    ...accountPaths,
    ...bankingPaths,
    ...transactionPaths,
    ...beneficiaryPaths,
    ...scheduledTransferPaths,
    ...reportPaths,
  },
};
