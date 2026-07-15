import { NextFunction, Request, Response } from "express";
import { validate as validateUuid } from "uuid";
import { BadRequestError } from "../errors/errors";

const MAX_IDEMPOTENCY_KEY_LENGTH = 255;

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

    if (idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
        throw new BadRequestError(`Idempotency-Key must be at most ${MAX_IDEMPOTENCY_KEY_LENGTH} characters`);
    }

    if (!validateUuid(idempotencyKey)) {
        throw new BadRequestError("Invalid Idempotency-Key");
    }

    (req as IdempotencyRequest).idempotencyKey = idempotencyKey;
    next();
}
