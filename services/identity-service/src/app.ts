import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import cors from "cors";
import pinoHttp from "pino-http";
import { ZodError } from "zod";

import { ApiError } from "./errors/errors";
import authRouter from "./routes/auth.routes";

const app = express();

// ── Global middleware ──────────────────────────────────────────────────────────
app.use(pinoHttp());
app.use(express.json());
app.use(helmet());
app.use(cors());

// ── Health endpoint ────────────────────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "UP" });
});

// ── Authentication routes ──────────────────────────────────────────────────────
// POST /api/v1/auth/register
// POST /api/v1/auth/login
app.use("/api/v1/auth", authRouter);

// ── 404 handler ────────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: "Not Found" });
});

// ── Centralised error handler ──────────────────────────────────────────────────
// IMPORTANT: must be declared with 4 parameters so Express recognises it as an
// error handler (even though _next is unused).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // 1. Zod validation errors → 400
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

  // 2. Known operational API errors (UnauthorizedError, ConflictError,
  //    ServiceUnavailableError, etc.) — use their statusCode directly.
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  // 3. Unexpected / non-operational errors — never expose internals.
  console.error("[identity-service] Unexpected error:", err);
  res.status(500).json({
    success: false,
    message: "Internal Server Error",
  });
});

export default app;
