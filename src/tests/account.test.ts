import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, NotFoundError } from "../errors/errors";
import { createAccount, getAccountById } from "../modules/accounts/account.service";
import * as accountRepository from "../modules/accounts/account.repository";

vi.mock("../modules/accounts/account.repository", () => ({
    create: vi.fn(),
    findByName: vi.fn(),
    findById: vi.fn(),
    findAll: vi.fn(),
    updateById: vi.fn(),
    deleteById: vi.fn(),
}));

describe("account service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("creates an account when the name is available", async () => {
        vi.mocked(accountRepository.findByName).mockResolvedValue(null);
        vi.mocked(accountRepository.create).mockResolvedValue({
            id: "account-1",
            name: "Cash",
            type: "ASSET",
            category: "SYSTEM",
            createdAt: new Date("2024-01-01T00:00:00.000Z"),
        });

        await expect(
            createAccount({
                name: "Cash",
                type: "ASSET",
                category: "SYSTEM",
            })
        ).resolves.toMatchObject({ id: "account-1", name: "Cash" });
    });

    it("throws a conflict error when the account name already exists", async () => {
        vi.mocked(accountRepository.findByName).mockResolvedValue({
            id: "account-1",
            name: "Cash",
            type: "ASSET",
            category: "SYSTEM",
            createdAt: new Date("2024-01-01T00:00:00.000Z"),
        });

        await expect(
            createAccount({
                name: "Cash",
                type: "ASSET",
                category: "SYSTEM",
            })
        ).rejects.toThrow(ConflictError);
    });

    it("throws a not found error when the account does not exist", async () => {
        vi.mocked(accountRepository.findById).mockResolvedValue(null);

        await expect(getAccountById("missing-id")).rejects.toThrow(NotFoundError);
    });
});
