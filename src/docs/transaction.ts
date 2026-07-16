export const transactionPaths = {
  "/transactions/{transactionId}": {
    get: {
      tags: ["Transactions"],

      summary: "Get transaction details",

      description:
        "Returns a transaction along with all associated ledger entries.",

      parameters: [
        {
          name: "transactionId",

          in: "path",

          required: true,

          schema: {
            type: "string",
            format: "uuid",
          },

          example: "6c8d6bfc-9d1b-4a39-a5a8-cd59d27d3ef9",
        },
      ],

      responses: {
        "200": {
          description: "Transaction found",

          content: {
            "application/json": {
              example: {
                success: true,

                data: {
                  id: "6c8d6bfc-9d1b-4a39-a5a8-cd59d27d3ef9",

                  reference: "TXN-20260715-000001",

                  type: "TRANSFER",

                  createdAt: "2026-07-15T10:30:00.000Z",

                  ledgerEntries: [
                    {
                      accountId: "acc-1",
                      entryType: "DEBIT",
                      amount: "1000.00",
                    },
                    {
                      accountId: "acc-2",
                      entryType: "CREDIT",
                      amount: "1000.00",
                    },
                  ],
                },
              },
            },
          },
        },

        "404": {
          description: "Transaction not found",
        },
      },
    },
  },
};