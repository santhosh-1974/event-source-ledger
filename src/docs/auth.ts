export const authPaths = {
  "/auth/register": {
    post: {
      tags: ["Authentication"],
      summary: "Register a customer and credential",
      description: "Creates the customer and password credential atomically and returns a bearer token.",
      security: [],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["name", "email", "phone", "password"],
              properties: {
                name: { type: "string", minLength: 3, maxLength: 255 },
                email: { type: "string", format: "email" },
                phone: { type: "string", pattern: "^\\d{10}$" },
                password: { type: "string", minLength: 12, maxLength: 72 },
              },
            },
          },
        },
      },
      responses: {
        "201": { description: "Customer registered and authenticated" },
        "400": { description: "Validation failed" },
        "409": { description: "Email or phone already exists" },
      },
    },
  },
  "/auth/login": {
    post: {
      tags: ["Authentication"],
      summary: "Authenticate a customer",
      security: [],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["email", "password"],
              properties: {
                email: { type: "string", format: "email" },
                password: { type: "string", minLength: 12, maxLength: 72 },
              },
            },
          },
        },
      },
      responses: {
        "200": { description: "Authentication succeeded" },
        "400": { description: "Validation failed" },
        "401": { description: "Invalid email or password" },
      },
    },
  },
};
