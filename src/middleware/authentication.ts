import { NextFunction, Request, Response } from "express";

import { UnauthorizedError } from "../errors/errors";
import { verifyAccessToken } from "../modules/auth/auth.service";

export interface AuthenticatedUser {
  customerId: string;
}

declare module "express-serve-static-core" {
  interface Request {
    auth?: AuthenticatedUser;
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authorization = req.header("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }

  try {
    req.auth = { customerId: verifyAccessToken(match[1]) };
    next();
  } catch {
    next(new UnauthorizedError("Invalid or expired authentication token"));
  }
}
