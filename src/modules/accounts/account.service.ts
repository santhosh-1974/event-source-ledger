import { ConflictError, NotFoundError } from "../../errors/errors";
import { create, deleteById, findAll, findById, findByName, updateById } from "./account.repository";
import { CreateAccountInput, UpdateAccountInput } from "./account.schema";
import { Account } from "./account.types";

export async function createAccount(data: CreateAccountInput): Promise<Account> {
    const existingAccount = await findByName(data.name);
    if (existingAccount) {
        throw new ConflictError("Account name already exists");
    }

    return create(data);
}

export async function getAccountById(accountId: string): Promise<Account> {
    const account = await findById(accountId);
    if (!account) {
        throw new NotFoundError("Account not found.");
    }

    return account;
}

export async function getAllAccounts(): Promise<Account[]> {
    return findAll();
}

export async function updateAccount(accountId: string, data: UpdateAccountInput): Promise<Account> {
    const updatedAccount = await updateById(accountId, data);
    if (!updatedAccount) {
        throw new NotFoundError("Account not found.");
    }

    return updatedAccount;
}

export async function deleteAccount(accountId: string): Promise<void> {
    const deleted = await deleteById(accountId);
    if (!deleted) {
        throw new NotFoundError("Account not found.");
    }
}
