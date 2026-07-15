import { PoolClient } from "pg";
import { createHash } from "crypto";
import { env } from "../../config/env";
import { ConflictError, InternalServerError } from "../../errors/errors";
import * as idempotencyRepository from "./idempotency.repository";
import { IdempotencyKeyRecord } from "./idempotency.types";

export type CheckOrCreateResult =
    | { kind: "new" }
    | { kind: "existing"; record: IdempotencyKeyRecord };

function stableStringify(value: unknown): string {
    if (value === null) {
        return "null";
    }

    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(",")}]`;
    }

    if (typeof value === "object") {
        const sortedKeys = Object.keys(value as Record<string, unknown>).sort();
        return `{${sortedKeys.map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`).join(",")}}`;
    }

    return JSON.stringify(value);
}

export function buildRequestHash(body: unknown): string {
    const normalized = stableStringify(body);
    return createHash("sha256").update(normalized).digest("hex");
}

export function calculateExpiry(): Date {
    return new Date(Date.now() + env.IDEMPOTENCY_TTL_SECONDS * 1000);
}

export function validateRequestHash(existing: IdempotencyKeyRecord, currentHash: string): void {
    if (existing.requestHash !== currentHash) {
        throw new ConflictError("Request Hash Mismatch");
    }
}

export function validateEndpoint(existing: IdempotencyKeyRecord, endpoint: string): void {
    if (existing.endpoint !== endpoint) {
        throw new ConflictError("Idempotency-Key already used for a different endpoint");
    }
}

function assertReusableOrThrow(existing: IdempotencyKeyRecord): void {
    if (existing.status === "IN_PROGRESS") {
        throw new ConflictError("Request with this Idempotency-Key is still in progress");
    }

    if (existing.status === "FAILED") {
        throw new ConflictError("Previous request with this Idempotency-Key failed");
    }
}

export function getStoredResponse(existing: IdempotencyKeyRecord): unknown {
    if (existing.status === "IN_PROGRESS") {
        throw new ConflictError("Request with this Idempotency-Key is still in progress");
    }

    if (existing.status === "FAILED") {
        throw new ConflictError("Previous request with this Idempotency-Key failed");
    }

    if (existing.status !== "COMPLETED") {
        throw new InternalServerError("Stored response is unavailable");
    }

    return existing.response;
}

/**
 * Finds an existing non-expired idempotency record, or creates one.
 * Handles concurrent inserts via ON CONFLICT (including reclaim of expired rows).
 */
export async function checkOrCreateIdempotencyRecord(
    idempotencyKey: string,
    requestHash: string,
    endpoint: string,
    client?: PoolClient
): Promise<CheckOrCreateResult> {
    const existing = await idempotencyRepository.findByKey(idempotencyKey, client);

    if (existing) {
        validateEndpoint(existing, endpoint);
        validateRequestHash(existing, requestHash);
        assertReusableOrThrow(existing);
        return { kind: "existing", record: existing };
    }

    const created = await idempotencyRepository.createOrReclaim(
        {
            idempotencyKey,
            requestHash,
            endpoint,
            expiresAt: calculateExpiry(),
        },
        client
    );

    if (created) {
        return { kind: "new" };
    }

    const concurrent = await idempotencyRepository.findByKey(idempotencyKey, client);
    if (!concurrent) {
        throw new InternalServerError("Failed to create idempotency record");
    }

    validateEndpoint(concurrent, endpoint);
    validateRequestHash(concurrent, requestHash);
    assertReusableOrThrow(concurrent);
    return { kind: "existing", record: concurrent };
}

export async function completeRequest(idempotencyKey: string, response: unknown, client?: PoolClient): Promise<void> {
    await idempotencyRepository.markCompleted(idempotencyKey, response, client);
}

export async function failRequest(idempotencyKey: string, client?: PoolClient): Promise<void> {
    await idempotencyRepository.markFailed(idempotencyKey, client);
}

export async function cleanupExpiredKeys(): Promise<number> {
    return idempotencyRepository.deleteExpired();
}
