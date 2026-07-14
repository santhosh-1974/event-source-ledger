import { PoolClient } from "pg";
import { createHash } from "crypto";
import { ConflictError, InternalServerError } from "../../errors/errors";
import * as idempotencyRepository from "./idempotency.repository";
import { CreateIdempotencyKeyInput, IdempotencyKeyRecord } from "./idempotency.types";

const IDENTITY_EXPIRE_SECONDS = 60 * 60;

export async function findExistingKey(idempotencyKey: string, client?: PoolClient): Promise<IdempotencyKeyRecord | null> {
    return idempotencyRepository.findByKey(idempotencyKey, client);
}

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

export async function createInProgressRecord(input: CreateIdempotencyKeyInput, client?: PoolClient): Promise<IdempotencyKeyRecord> {
    return idempotencyRepository.create(input, client);
}

export function validateRequestHash(existing: IdempotencyKeyRecord, currentHash: string): void {
    if (existing.requestHash !== currentHash) {
        throw new ConflictError("Request Hash Mismatch");
    }
}

export function getStoredResponse(existing: IdempotencyKeyRecord): unknown {
    if (existing.status !== "COMPLETED") {
        throw new InternalServerError("Stored response is unavailable");
    }

    return existing.response;
}

export async function completeRequest(idempotencyKey: string, response: unknown, client?: PoolClient): Promise<void> {
    await idempotencyRepository.markCompleted(idempotencyKey, response, client);
}

export async function failRequest(idempotencyKey: string, client?: PoolClient): Promise<void> {
    await idempotencyRepository.markFailed(idempotencyKey, client);
}

export function calculateExpiry(): Date {
    return new Date(Date.now() + IDENTITY_EXPIRE_SECONDS * 1000);
}
