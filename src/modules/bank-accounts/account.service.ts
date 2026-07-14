import { ConflictError, NotFoundError } from "../../errors/errors";
import { create, deleteById, findAll, findById, findByAccountNumber, findByName, updateById, updateStatus } from "./account.repository";
import { CreateAccountInput, UpdateAccountInput, UpdateAccountStatusInput } from "./account.schema";
import { AccountStatus, BankAccount } from "./account.types";

export async function createAccount(data: CreateAccountInput): Promise<BankAccount> {
    const existingAccount = await findByName(data.accountNumber);
    if (existingAccount) {
        throw new ConflictError("Account number already exists");
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

function validateStatusTransition(currentStatus: AccountStatus, nextStatus: AccountStatus): void {
    if (currentStatus === "CLOSED" && nextStatus !== "CLOSED") {
        throw new ConflictError("Closed accounts cannot be reopened.");
    }
}

export async function updateAccountStatus(accountNumber: string, data: UpdateAccountStatusInput): Promise<{ accountNumber: string; status: AccountStatus }> {
    const account = await findByAccountNumber(accountNumber);
    if (!account) {
        throw new NotFoundError("Account not found.");
    }

    validateStatusTransition(account.status, data.status);

    const updatedAccount = await updateStatus(accountNumber, data.status);
    if (!updatedAccount) {
        throw new NotFoundError("Account not found.");
    }

    return {
        accountNumber: updatedAccount.accountNumber,
        status: updatedAccount.status,
    };
}
