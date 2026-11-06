import crypto from "crypto";
import { NextFunction, Request, Response, Router } from "express";
import { env } from "../../config/env";
import { UnauthorizedError } from "../../errors/errors";
import { createInternalCustomerHandler } from "./internal.controller";

const router = Router();

/**
 * Middleware: validates the x-internal-service-secret header using a
 * constant-time comparison to prevent timing attacks.
 */
function verifyInternalSecret(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const incoming = req.headers["x-internal-service-secret"];

  if (typeof incoming !== "string" || incoming.length === 0) {
    throw new UnauthorizedError("Missing internal service secret");
  }

  const expected = env.CUSTOMER_PROVISIONING_SECRET;

  // Pad both buffers to the same length before comparing so that
  // Buffer.byteLength differences don't short-circuit the comparison.
  const incomingBuf = Buffer.from(incoming);
  const expectedBuf = Buffer.from(expected);

  if (incomingBuf.length !== expectedBuf.length) {
    throw new UnauthorizedError("Invalid internal service secret");
  }

  const match = crypto.timingSafeEqual(incomingBuf, expectedBuf);
  if (!match) {
    throw new UnauthorizedError("Invalid internal service secret");
  }

  next();
}

router.post("/customers", verifyInternalSecret, createInternalCustomerHandler);

export default router;
