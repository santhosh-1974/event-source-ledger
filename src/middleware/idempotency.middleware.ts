import { NextFunction, Request, Response } from "express";
import { validate as validateUuid } from "uuid";
import { BadRequestError } from "../errors/errors";

export interface IdempotencyRequest extends Request {
    idempotencyKey: string;
}

export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): void {
    const rawKey = req.header("Idempotency-Key");

    if (!rawKey) {
        throw new BadRequestError("Missing Idempotency-Key");
    }

    const idempotencyKey = rawKey.trim();

    if (idempotencyKey.length === 0) {
        throw new BadRequestError("Invalid Idempotency-Key");
    }

    if (!validateUuid(idempotencyKey)) {
        throw new BadRequestError("Invalid Idempotency-Key");
    }

    (req as IdempotencyRequest).idempotencyKey = idempotencyKey;
    next();
}
