export const customerPaths = {
  "/customers/create-customer": {
    post: {
      tags: ["Customers"],

      summary: "Create a new customer",

      description:
        "Creates a new customer in the banking system.",

      requestBody: {
        required: true,

        content: {
          "application/json": {
            schema: {
              type: "object",

              required: [
                "name",
                "email",
                "phone",
              ],

              properties: {
                name: {
                  type: "string",
                  example: "John Doe",
                },

                email: {
                  type: "string",
                  example: "john@example.com",
                },

                phone: {
                  type: "string",
                  example: "9876543210",
                },
              },
            },
          },
        },
      },

      responses: {
        "201": {
          description: "Customer created successfully",
        },

        "400": {
          description: "Validation failed",
        },

        "409": {
          description: "Customer already exists",
        },
      },
    },
  },
};