
export type IdempotencyStatus = "IN_PROGRESS" | "COMPLETED" | "FAILED";

export interface IdempotencyKeyRecord {
    id: string;
    idempotencyKey: string;
    requestHash: string;
    endpoint: string;
    status: IdempotencyStatus;
    response: unknown | null;
    createdAt: Date;
    expiresAt: Date;
}

export interface CreateIdempotencyKeyInput {
    idempotencyKey: string;
    requestHash: string;
    endpoint: string;
    expiresAt: Date;
}

export interface MarkCompletedInput {
    idempotencyKey: string;
    response: unknown;
}

export interface MarkFailedInput {
    idempotencyKey: string;
}
