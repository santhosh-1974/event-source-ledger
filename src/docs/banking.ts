export const bankingPaths = {
  "/banking/deposit": {
    post: {
      tags: ["Banking"],

      summary: "Deposit money",

      description:
        "Deposits money into a bank account using an idempotent request.",

      security: [
        {
          IdempotencyKey: [],
        },
      ],

      requestBody: {
        required: true,

        content: {
          "application/json": {
            schema: {
              type: "object",

              required: [
                "accountNumber",
                "amount",
              ],

              properties: {
                accountNumber: {
                  type: "string",
                  example: "1000000001",
                },

                amount: {
                  type: "string",
                  example: "1000.00",
                },
              },
            },

            examples: {
              deposit: {
                summary: "Deposit ₹1000",

                value: {
                  accountNumber: "1000000001",
                  amount: "1000.00",
                },
              },
            },
          },
        },
      },

      responses: {
        "201": {
          description: "Deposit successful",

          content: {
            "application/json": {
              example: {
                success: true,

                data: {
                  transactionId: "8f8db816-b4cb-4f44-a75b-f64df08e1b76",

                  reference: "TXN-20260715-000001",

                  accountNumber: "1000000001",

                  amount: "1000.00",

                  balance: "5000.00",

                  createdAt: "2026-07-15T16:00:00.000Z",
                },
              },
            },
          },
        },

        "400": {
          description: "Validation failed",
        },

        "404": {
          description: "Account not found",
        },

        "409": {
          description: "Duplicate request or business rule violation",
        },
      },
    },
  },

  "/banking/withdraw": {
  post: {
    tags: ["Banking"],

    summary: "Withdraw money",

    description:
      "Withdraws money from a bank account. The request is idempotent.",

    security: [
      {
        IdempotencyKey: [],
      },
    ],

    requestBody: {
      required: true,

      content: {
        "application/json": {
          schema: {
            type: "object",

            required: [
              "accountNumber",
              "amount",
            ],

            properties: {
              accountNumber: {
                type: "string",
                example: "1000000001",
              },

              amount: {
                type: "string",
                example: "500.00",
              },
            },
          },
        },
      },
    },

    responses: {
      "200": {
        description: "Withdrawal successful",
      },

      "400": {
        description: "Validation failed",
      },

      "404": {
        description: "Account not found",
      },

      "409": {
        description: "Insufficient funds or duplicate request",
      },
    },
  },
},

    "/banking/transfer": {
  post: {
    tags: ["Banking"],

    summary: "Transfer money",

    description:
      "Transfers money between two bank accounts using double-entry bookkeeping.",

    security: [
      {
        IdempotencyKey: [],
      },
    ],

    requestBody: {
      required: true,

      content: {
        "application/json": {
          schema: {
            type: "object",

            required: [
              "fromAccountNumber",
              "toAccountNumber",
              "amount",
            ],

            properties: {
              fromAccountNumber: {
                type: "string",
                example: "1000000001",
              },

              toAccountNumber: {
                type: "string",
                example: "1000000002",
              },

              amount: {
                type: "string",
                example: "1000.00",
              },
            },
          },
        },
      },
    },

    responses: {
      "200": {
        description: "Transfer successful",
      },

      "400": {
        description: "Validation failed",
      },

      "404": {
        description: "Account not found",
      },

      "409": {
        description: "Insufficient funds or duplicate request",
      },
    },
  },
},

"/banking/{accountNumber}/balance": {
  get: {
    tags: ["Banking"],

    summary: "Get current account balance",

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
        description: "Current balance",
      },

      "404": {
        description: "Account not found",
      },
    },
  },
},

"/banking/{accountNumber}/balance-at-time": {
  get: {
    tags: ["Banking"],

    summary: "Get historical balance",

    description:
      "Returns the account balance at a specific point in time using event sourcing.",

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

      {
        name: "at",

        in: "query",

        required: true,

        schema: {
          type: "string",
          format: "date-time",
        },

        example: "2026-07-15T15:30:00.000Z",
      },
    ],

    responses: {
      "200": {
        description: "Historical balance",
      },

      "404": {
        description: "Account not found",
      },
    },
  },
},

"/banking/{accountNumber}/history": {
  get: {
    tags: ["Banking"],

    summary: "Get transaction history",

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

      {
        name: "page",

        in: "query",

        schema: {
          type: "integer",
          default: 1,
        },
      },

      {
        name: "limit",

        in: "query",

        schema: {
          type: "integer",
          default: 20,
        },
      },
    ],

    responses: {
      "200": {
        description: "Transaction history",
      },

      "404": {
        description: "Account not found",
      },
    },
  },
},
};

