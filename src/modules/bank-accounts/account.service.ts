import { ConflictError, NotFoundError } from "../../errors/errors";
import { create, deleteById, findAll, findById, findByName, updateById } from "./account.repository";
import { CreateAccountInput, UpdateAccountInput } from "./account.schema";
import { BankAccount } from "./account.types";

export async function createAccount(data: CreateAccountInput): Promise<BankAccount> {
    const existingAccount = await findByName(data.name);
    if (existingAccount) {
        throw new ConflictError("Account name already exists");
    }

    return create(data);
}

export async function getAccountById(accountId: string): Promise<BankAccount> {
    const account = await findById(accountId);
    if (!account) {
        throw new NotFoundError("Account not found.");
    }

    return account;
}

export async function getAllAccounts(): Promise<BankAccount[]> {
    return findAll();
}

export async function updateAccount(accountId: string, data: UpdateAccountInput): Promise<BankAccount> {
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
