export const accountPaths = {
  "/accounts": {
    post: {
      tags: ["Accounts"],

      summary: "Create a bank account",

      description:
        "Creates a new bank account for an existing customer.",

      requestBody: {
        required: true,

        content: {
          "application/json": {
            schema: {
              type: "object",

              required: [
                "customerId",
                "accountType",
              ],

              properties: {
                customerId: {
                  type: "string",
                  format: "uuid",
                  example: "a83a4cb2-7f63-45ff-89f0-4dc8ec6359d8",
                },

                accountType: {
                  type: "string",

                  enum: [
                    "SAVINGS",
                    "CURRENT",
                  ],

                  example: "SAVINGS",
                },
              },
            },

            examples: {
              savings: {
                summary: "Savings Account",

                value: {
                  customerId: "a83a4cb2-7f63-45ff-89f0-4dc8ec6359d8",
                  accountType: "SAVINGS",
                },
              },
            },
          },
        },
      },

      responses: {
        "201": {
          description: "Account created successfully",
        },

        "400": {
          description: "Validation failed",
        },

        "404": {
          description: "Customer not found",
        },

        "409": {
          description: "Account already exists",
        },
      },
    },

    get: {
      tags: ["Accounts"],

      summary: "Get all accounts",

      responses: {
        "200": {
          description: "List of accounts",
        },
      },
    },
  },

  "/accounts/{accountNumber}": {
    get: {
      tags: ["Accounts"],

      summary: "Get account by account number",

      parameters: [
        {
          name: "accountNumber",

          in: "path",

          required: true,

          schema: {
            type: "string",
          },

          example: "1000000001",
        },
      ],

      responses: {
        "200": {
          description: "Account found",
        },

        "404": {
          description: "Account not found",
        },
      },
    },
  },
};
