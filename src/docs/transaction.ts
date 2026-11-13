export const transactionPaths = {
  "/transactions/{transactionId}": {
    get: {
      tags: ["Transactions"],
      summary: "Get transaction details for an owned account",
      description:
        "A customer may read a transaction if at least one of its ledger entries belongs to one of their accounts. Other customers receive 404.",
      parameters: [
        {
          name: "transactionId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      responses: {
        "200": {
          description: "Transaction and associated ledger entries",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TransactionDetailsEnvelope" },
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
