import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

import { env } from "../config/env";

const JWT_ISSUER = "event-sourced-ledger";
const JWT_AUDIENCE = "banking-api";

declare module "express-serve-static-core" {
  interface Request {
    customerId?: string;
  }
}

export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const match = req.header("authorization")?.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ success: false, message: "Authentication required" });
    return;
  }

  try {
    const payload = jwt.verify(match[1], env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as JwtPayload & { customerId?: unknown };

    if (typeof payload.sub !== "string" || payload.customerId !== payload.sub) {
      throw new Error("Invalid customer claims");
    }
    req.customerId = payload.sub;
    next();
  } catch {
    res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token",
    });
  }
}
