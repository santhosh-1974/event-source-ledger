const accountResponse = {
  description: "Account response",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/AccountEnvelope" },
    },
  },
};

export const accountPaths = {
  "/accounts": {
    get: {
      tags: ["Accounts"],
      summary: "List the authenticated customer's accounts",
      responses: {
        "200": {
          description: "Accounts belonging to the authenticated customer",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AccountListEnvelope" },
            },
          },
        },
        "401": { $ref: "#/components/responses/Unauthorized" },
      },
    },
    post: {
      tags: ["Accounts"],
      summary: "Create a bank account",
      description:
        "The customerId must match the authenticated customer and exist in Customer Service.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CreateAccountRequest" },
          },
        },
      },
      responses: {
        "201": accountResponse,
        "400": { $ref: "#/components/responses/ValidationError" },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "404": { $ref: "#/components/responses/NotFound" },
        "409": { $ref: "#/components/responses/Conflict" },
        "500": { $ref: "#/components/responses/ServerError" },
        "503": { $ref: "#/components/responses/ServiceUnavailable" },
      },
    },
  },
  "/accounts/{accountId}": {
    get: {
      tags: ["Accounts"],
      summary: "Get an owned account",
      parameters: [
        {
          name: "accountId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      responses: {
        "200": accountResponse,
        "400": { $ref: "#/components/responses/ValidationError" },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "404": { $ref: "#/components/responses/NotFound" },
      },
    },
  },
};
