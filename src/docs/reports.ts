export const reportPaths = {
  "/reports/statements/{accountNumber}": {
    get: {
      tags: ["Reports"],
      summary: "Generate an account statement",
      description:
        "Reads the authoritative ledger in a repeatable-read, read-only snapshot. Dates are inclusive UTC calendar dates, limited to 366 days and 5,000 entries. JSON or CSV output is available.",
      parameters: [
        {
          name: "accountNumber",
          in: "path",
          required: true,
          schema: { type: "string", maxLength: 20 },
        },
        {
          name: "from",
          in: "query",
          required: true,
          schema: { type: "string", format: "date" },
        },
        {
          name: "to",
          in: "query",
          required: true,
          schema: { type: "string", format: "date" },
        },
        {
          name: "format",
          in: "query",
          required: false,
          schema: { type: "string", enum: ["json", "csv"], default: "json" },
        },
      ],
      responses: {
        "200": {
          description: "Ledger-reconciled account statement",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/StatementEnvelope" },
            },
            "text/csv": { schema: { type: "string" } },
          },
        },
        "400": { $ref: "#/components/responses/ValidationError" },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "404": { $ref: "#/components/responses/NotFound" },
      },
    },
  },
};
