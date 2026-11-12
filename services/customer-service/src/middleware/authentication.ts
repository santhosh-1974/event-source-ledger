import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

import { env } from "../config/env";
import { UnauthorizedError } from "../errors/errors";

const JWT_ISSUER = "event-sourced-ledger";
const JWT_AUDIENCE = "banking-api";

declare module "express-serve-static-core" {
  interface Request {
    customerId?: string;
  }
}

export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const match = req.header("authorization")?.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }

  try {
    const payload = jwt.verify(match[1], env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as JwtPayload & { customerId?: unknown };

    if (
      typeof payload.sub !== "string" ||
      payload.customerId !== payload.sub
    ) {
      throw new UnauthorizedError("Invalid or expired authentication token");
    }

    req.customerId = payload.sub;
    next();
  } catch {
    next(new UnauthorizedError("Invalid or expired authentication token"));
  }
}
