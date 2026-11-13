import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import pinoHttp from "pino-http";

import { logger } from "./config/logger.js";
import {
  bankingServiceProxy,
  customerServiceProxy,
  identityServiceProxy,
} from "./middleware/proxy.js";

const app = express();

// ── Security middleware ────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS configuration ─────────────────────────────────────────────────────────
// Match the existing services' CORS configuration
app.use(cors());

// ── Request logging ────────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
  })
);

// ── Health check endpoint ──────────────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "UP",
    service: "api-gateway",
    timestamp: new Date().toISOString(),
  });
});

// ── Proxy routes ───────────────────────────────────────────────────────────────
// Route authentication requests to Identity Service
app.use("/api/v1/auth", identityServiceProxy);

// Keep service-to-service provisioning routes off the public API.
app.use("/api/v1/internal", (_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Not Found",
  });
});

// Route customer profile requests to the Customer Service.
app.use("/api/v1/customers", customerServiceProxy);

// Expose only the versioned Banking Core resources through the public Gateway.
app.use("/api/v1/accounts", bankingServiceProxy);
app.use("/api/v1/banking", bankingServiceProxy);
app.use("/api/v1/transactions", bankingServiceProxy);

// ── 404 handler ────────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Not Found",
  });
});

// ── Global error handler ───────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({
    msg: "Unhandled error in API Gateway",
    error: err instanceof Error ? err.message : String(err),
  });

  if (!res.headersSent) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

export default app;
