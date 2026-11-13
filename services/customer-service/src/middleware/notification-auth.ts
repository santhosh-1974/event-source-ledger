import { NextFunction, Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";

import { env } from "../config/env";
import { UnauthorizedError } from "../errors/errors";

export function verifyNotificationServiceSecret(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const incoming = req.header("x-notification-service-secret");
  if (!incoming) {
    next(new UnauthorizedError("Missing notification service secret"));
    return;
  }

  const actual = Buffer.from(incoming);
  const expected = Buffer.from(env.NOTIFICATION_CUSTOMER_LOOKUP_SECRET);
  if (
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  ) {
    next(new UnauthorizedError("Invalid notification service secret"));
    return;
  }

  next();
}
