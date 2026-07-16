export const schemas = {
  ErrorResponse: {
    type: "object",

    properties: {
      success: {
        type: "boolean",
        example: false,
      },

      message: {
        type: "string",
        example: "Validation failed",
      },
    },
  },

  Customer: {
    type: "object",

    properties: {
      id: {
        type: "string",
        format: "uuid",
      },

      fullName: {
        type: "string",
        example: "John Doe",
      },

      email: {
        type: "string",
        format: "email",
      },

      phone: {
        type: "string",
      },

      createdAt: {
        type: "string",
        format: "date-time",
      },
    },
  },

  Account: {
    type: "object",

    properties: {
      id: {
        type: "string",
        format: "uuid",
      },

      accountNumber: {
        type: "string",
        example: "1000000001",
      },

      accountType: {
        type: "string",
        enum: [
          "SAVINGS",
          "CURRENT",
        ],
      },

      status: {
        type: "string",
        enum: [
          "ACTIVE",
          "BLOCKED",
          "CLOSED",
        ],
      },

      createdAt: {
        type: "string",
        format: "date-time",
      },
    },
  },

  Transaction: {
    type: "object",

    properties: {
      transactionId: {
        type: "string",
        format: "uuid",
      },

      reference: {
        type: "string",
        example: "TXN-20260715-000001",
      },

      amount: {
        type: "string",
        example: "1000.00",
      },

      createdAt: {
        type: "string",
        format: "date-time",
      },
    },
  },

  Balance: {
    type: "object",

    properties: {
      accountNumber: {
        type: "string",
      },

      balance: {
        type: "string",
        example: "5500.00",
      },

      currency: {
        type: "string",
        example: "INR",
      },
    },
  },

  HistoryItem: {
    type: "object",

    properties: {
      transactionId: {
        type: "string",
      },

      reference: {
        type: "string",
      },

      type: {
        type: "string",
      },

      amount: {
        type: "string",
      },

      createdAt: {
        type: "string",
        format: "date-time",
      },
    },
  },
};