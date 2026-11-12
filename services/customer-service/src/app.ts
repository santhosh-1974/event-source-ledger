import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { ZodError } from "zod";

import { query } from "./database/database";
import { ApiError } from "./errors/errors";
import { authenticate } from "./middleware/authentication";
import customerRoutes from "./routes/customer.routes";
import internalRoutes from "./routes/internal.routes";

const app = express();

app.disable("x-powered-by");
app.use(
  pinoHttp({
    serializers: {
      req: (req) => ({
        id: req.id,
        method: req.method,
        url: req.url,
      }),
    },
  })
);
app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "UP", service: "customer-service" });
});

app.get("/ready", async (_req: Request, res: Response) => {
  await query("SELECT 1 FROM customer.customers LIMIT 0");
  res.json({ status: "READY", service: "customer-service" });
});

app.use("/api/v1/internal/customers", internalRoutes);
app.use("/api/v1/customers", authenticate, customerRoutes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: "Not Found" });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: err.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ success: false, message: err.message });
    return;
  }

  console.error("[customer-service] Unexpected error", err);
  res.status(500).json({ success: false, message: "Internal Server Error" });
});

export default app;
