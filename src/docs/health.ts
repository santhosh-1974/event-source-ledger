export const healthPaths = {
  "/health": {
    get: {
      tags: ["Health"],

      summary: "Health check",

      description:
        "Returns whether the application is running.",

      responses: {
        "200": {
          description: "Application is healthy",

          content: {
            "application/json": {
              example: {
                success: true,

                status: "UP",

                timestamp: "2026-07-15T10:30:00.000Z",
              },
            },
          },
        },
      },
    },
  },

  "/ready": {
    get: {
      tags: ["Health"],

      summary: "Readiness check",

      description:
        "Returns whether the application is ready to serve requests.",

      responses: {
        "200": {
          description: "Application is ready",

          content: {
            "application/json": {
              example: {
                success: true,

                status: "UP",

                database: "CONNECTED",

                timestamp: "2026-07-15T10:30:00.000Z",
              },
            },
          },
        },

        "503": {
          description: "Application is not ready",
        },
      },
    },
  },
};