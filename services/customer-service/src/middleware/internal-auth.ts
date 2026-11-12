import { NextFunction, Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";

import { env } from "../config/env";
import { UnauthorizedError } from "../errors/errors";

export function verifyInternalSecret(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const incoming = req.header("x-internal-service-secret");
  if (!incoming) {
    next(new UnauthorizedError("Missing internal service secret"));
    return;
  }

  const actual = Buffer.from(incoming);
  const expected = Buffer.from(env.CUSTOMER_PROVISIONING_SECRET);
  if (
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  ) {
    next(new UnauthorizedError("Invalid internal service secret"));
    return;
  }

  next();
}
