import { customerPaths } from "./customers";
import { schemas } from "./schemas";
import { accountPaths } from "./accounts";
import { bankingPaths } from "./banking";
import { transactionPaths } from "./transaction";
import { healthPaths } from "./health";

export const openApiSpec = {
  openapi: "3.0.3",

  info: {
    title: "Event-Sourced Ledger API",

    version: "1.0.0",

    description:
      "A banking backend implementing Event Sourcing, Double-Entry Accounting, Idempotency and ACID Transactions.",
  },

  servers: [
    {
      url: "http://localhost:5000/api/v1",

      description: "Local Development",
    },
  ],

  tags: [
    {
      name: "Customers",
    },

    {
      name: "Accounts",
    },

    {
      name: "Banking",
    },

    {
      name: "Transactions",
    },

    {
      name: "Health",
    },
  ],

  components: {
    schemas,

    securitySchemes: {
        IdempotencyKey: {
            type: "apiKey",

            in: "header",

            name: "Idempotency-Key",

            description:
                "Unique key used to safely retry requests without creating duplicate transactions.",
        },
    },
},

  paths: {
    ...customerPaths,
    ...accountPaths,
    ...bankingPaths,
    ...transactionPaths,
    ...healthPaths,
  },
};