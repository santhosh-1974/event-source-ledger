import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { ZodError } from "zod";

import { logger } from "./config/logger";
import { query } from "./database/database";
import preferencesRoutes from "./preferences/preferences.routes";

const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "16kb" }));
app.use(
  pinoHttp({
    logger,
    serializers: {
      req: (req) => ({
        id: req.id,
        method: req.method,
        url: req.url,
      }),
    },
  })
);

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "UP", service: "notification-service" });
});

app.get("/ready", async (_req: Request, res: Response) => {
  await query("SELECT 1 FROM notification.preferences LIMIT 0");
  res.json({ status: "READY", service: "notification-service" });
});

app.use("/api/v1/notifications", preferencesRoutes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: "Not Found" });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  logger.error({ err: error }, "Notification Service request failed");
  res.status(500).json({ success: false, message: "Internal Server Error" });
});

export default app;
