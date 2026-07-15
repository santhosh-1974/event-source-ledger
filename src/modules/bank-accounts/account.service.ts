import { ConflictError, NotFoundError } from "../../errors/errors";
import { getClient } from "../../database/database";
import { create, createCustomerLedgerAccount, deleteById, findAll, findById, findByAccountNumber, updateById, updateStatus } from "./account.repository";
import { CreateAccountInput, UpdateAccountInput, UpdateAccountStatusInput } from "./account.schema";
import { AccountStatus, BankAccount } from "./account.types";

export async function createAccount(data: CreateAccountInput): Promise<BankAccount> {
    const client = await getClient();
    try {
        await client.query("BEGIN");
        const customer = await client.query("SELECT 1 FROM customers WHERE id = $1 FOR KEY SHARE", [data.customerId]);
        if (customer.rowCount === 0) {
            throw new NotFoundError("Customer not found.");
        }

        const account = await create(data, client);
        await createCustomerLedgerAccount(account, client);
        await client.query("COMMIT");
        return account;
    } catch (error: unknown) {
        await client.query("ROLLBACK");
        if (isUniqueViolation(error, "bank_accounts_account_number_key")) {
            throw new ConflictError("Account number already exists");
        }
        throw error;
    } finally {
        client.release();
    }
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
    return typeof error === "object" && error !== null &&
        "code" in error && (error as { code?: string }).code === "23505" &&
        "constraint" in error && (error as { constraint?: string }).constraint === constraint;
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
