import { randomUUID } from "crypto";
import { PoolClient } from "pg";

import { getClient } from "../../database/database";
import { AccountClosedError, AccountFrozenError, ConflictError, InsufficientFundsError, InternalServerError, NotFoundError } from "../../errors/errors";

import * as bankAccountRepository from "../bank-accounts/account.repository";
import * as ledgerRepository from "../ledger/ledger.repository";
import * as transactionRepository from "../transactions/transaction.repository";
import * as idempotencyService from "../idempotency/idempotency.service";

import { depositInput, transferInput, withdrawInput } from "./banking.schema";
import { accountBalanceResult, depositResult, transferResult, transactionHistoryResult, withdrawResult } from "./banking.types";

const SYSTEM_CASH_LEDGER_NAME = "Cash";
const WITHDRAWAL_DESCRIPTION = "Cash Withdrawal";
const TRANSFER_DESCRIPTION_PREFIX = "Transfer";
const BANKING_ENDPOINTS = {
  deposit: "/api/v1/banking/deposit",
  withdraw: "/api/v1/banking/withdraw",
  transfer: "/api/v1/banking/transfer",
} as const;

function assertAccountIsOperable(status: string, subject = "Account"): void {
  if (status === "BLOCKED") throw new AccountFrozenError(`${subject} is blocked.`);
  if (status === "CLOSED") throw new AccountClosedError(`${subject} is closed.`);
}

function toCents(amount: string): bigint {
  const [whole, fraction = ""] = amount.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}

async function assertTransactionBalanced(transactionId: string, client: PoolClient): Promise<void> {
  const [debits, credits] = await Promise.all([
    ledgerRepository.calculateLedgerEntryTotal(transactionId, client, "DEBIT"),
    ledgerRepository.calculateLedgerEntryTotal(transactionId, client, "CREDIT"),
  ]);
  if (toCents(debits) !== toCents(credits)) throw new InternalServerError("Ledger entries are not balanced.");
}

async function withIdempotency<T>(
  idempotencyKey: string,
  requestHash: string,
  endpoint: string,
  client: PoolClient,
  execute: () => Promise<T>
): Promise<T> {
  let ownsIdempotencyRecord = false;

  try {
    await client.query("BEGIN");

    const result = await idempotencyService.checkOrCreateIdempotencyRecord(
      idempotencyKey,
      requestHash,
      endpoint,
      client
    );

    if (result.kind === "existing") {
      const stored = idempotencyService.getStoredResponse(result.record) as T;
      await client.query("ROLLBACK");
      return stored;
    }

    ownsIdempotencyRecord = true;
    const response = await execute();
    await idempotencyService.completeRequest(idempotencyKey, response, client);
    await client.query("COMMIT");
    return response;
  } catch (error) {
    await client.query("ROLLBACK");

    if (ownsIdempotencyRecord) {
      await idempotencyService.failRequest(idempotencyKey, client);
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function deposit(input: depositInput, idempotencyKey: string): Promise<depositResult> {
  const client = await getClient();
  const requestHash = idempotencyService.buildRequestHash(input);
  const endpoint = BANKING_ENDPOINTS.deposit;

  return withIdempotency(idempotencyKey, requestHash, endpoint, client, async () => {
    const bankAccount = await bankAccountRepository.findBankAccountByNumberForUpdate(input.accountNumber, client);
    if (!bankAccount) {
      throw new NotFoundError("Bank account not found.");
    }

    assertAccountIsOperable(bankAccount.status);

    const customerLedger = await ledgerRepository.findCustomerLedgerAccount(bankAccount.id, client);
    if (!customerLedger) {
      throw new NotFoundError("Customer ledger account not found.");
    }

    const cashLedger = await ledgerRepository.findSystemLedgerAccount(SYSTEM_CASH_LEDGER_NAME, client);
    if (!cashLedger) {
      throw new NotFoundError("Cash ledger account not found.");
    }

    const reference = randomUUID();
    const transaction = await transactionRepository.create(reference, "Cash Deposit", client);

    await ledgerRepository.createLedgerEntry(transaction.id, cashLedger.id, "DEBIT", input.amount, client);
    await ledgerRepository.createLedgerEntry(transaction.id, customerLedger.id, "CREDIT", input.amount, client);
    await assertTransactionBalanced(transaction.id, client);

    return {
      transactionId: transaction.id,
      reference: transaction.reference,
    };
  });
}

export async function withdraw(input: withdrawInput, idempotencyKey: string): Promise<withdrawResult> {
  const client = await getClient();
  const requestHash = idempotencyService.buildRequestHash(input);
  const endpoint = BANKING_ENDPOINTS.withdraw;

  try {
    return await withIdempotency(idempotencyKey, requestHash, endpoint, client, async () => {
      const lockedAccount = await bankAccountRepository.findBankAccountByNumberForUpdate(input.accountNumber, client);
      if (!lockedAccount) {
        throw new NotFoundError("Bank account not found.");
      }

      assertAccountIsOperable(lockedAccount.status);

      const customerLedger = await ledgerRepository.findCustomerLedgerAccount(lockedAccount.id, client);
      if (!customerLedger) {
        throw new NotFoundError("Customer ledger account not found.");
      }

      const cashLedger = await ledgerRepository.findSystemLedgerAccount(SYSTEM_CASH_LEDGER_NAME, client);
      if (!cashLedger) {
        throw new NotFoundError("Cash ledger account not found.");
      }

      const balance = await ledgerRepository.calculateLedgerBalance(customerLedger.id, client);
      if (toCents(balance) < toCents(input.amount)) {
        throw new InsufficientFundsError("Insufficient funds for withdrawal.");
      }

      const reference = randomUUID();
      const transaction = await transactionRepository.create(reference, WITHDRAWAL_DESCRIPTION, client);

      await ledgerRepository.createLedgerEntry(transaction.id, customerLedger.id, "DEBIT", input.amount, client);
      await ledgerRepository.createLedgerEntry(transaction.id, cashLedger.id, "CREDIT", input.amount, client);
      await assertTransactionBalanced(transaction.id, client);

      return {
        transactionId: transaction.id,
        reference: transaction.reference,
      };
    });
  } catch (error) {
    if (
      error instanceof NotFoundError ||
      error instanceof InsufficientFundsError ||
      error instanceof AccountFrozenError ||
      error instanceof AccountClosedError ||
      error instanceof ConflictError
    ) {
      throw error;
    }

    throw new InternalServerError("Failed to process withdrawal.");
  }
}

export async function transfer(input: transferInput, idempotencyKey: string): Promise<transferResult> {
  const client = await getClient();
  const requestHash = idempotencyService.buildRequestHash(input);
  const endpoint = BANKING_ENDPOINTS.transfer;

  try {
    return await withIdempotency(idempotencyKey, requestHash, endpoint, client, async () => {
      if (input.fromAccountNumber === input.toAccountNumber) {
        throw new ConflictError("Sender and receiver accounts must be different.");
      }

      const senderAccount = await bankAccountRepository.findBankAccountByNumber(input.fromAccountNumber, client);
      const receiverAccount = await bankAccountRepository.findBankAccountByNumber(input.toAccountNumber, client);

      if (!senderAccount || !receiverAccount) {
        throw new NotFoundError("Sender or receiver bank account not found.");
      }

      const senderAccountId = senderAccount.id;
      const receiverAccountId = receiverAccount.id;

      const orderedIds = [senderAccountId, receiverAccountId].sort();
      const firstAccount = await bankAccountRepository.findBankAccountByIdForUpdate(orderedIds[0], client);
      const secondAccount = await bankAccountRepository.findBankAccountByIdForUpdate(orderedIds[1], client);

      if (!firstAccount || !secondAccount) {
        throw new NotFoundError("Sender or receiver bank account not found.");
      }

      const lockedById = new Map([[firstAccount.id, firstAccount], [secondAccount.id, secondAccount]]);
      assertAccountIsOperable(lockedById.get(senderAccountId)!.status, "Sender account");
      assertAccountIsOperable(lockedById.get(receiverAccountId)!.status, "Receiver account");

      const senderLedger = await ledgerRepository.findCustomerLedgerAccount(senderAccountId, client);
      const receiverLedger = await ledgerRepository.findCustomerLedgerAccount(receiverAccountId, client);

      if (!senderLedger || !receiverLedger) {
        throw new NotFoundError("Customer ledger account not found.");
      }

      const senderBalance = await ledgerRepository.calculateLedgerBalance(senderLedger.id, client);
      if (toCents(senderBalance) < toCents(input.amount)) {
        throw new InsufficientFundsError("Insufficient funds for transfer.");
      }

      const reference = randomUUID();
      const description = input.description?.trim() || TRANSFER_DESCRIPTION_PREFIX;
      const transaction = await transactionRepository.create(reference, description, client);

      const cashLedger = await ledgerRepository.findSystemLedgerAccount(SYSTEM_CASH_LEDGER_NAME, client);
      if (!cashLedger) throw new NotFoundError("Cash ledger account not found.");

      await ledgerRepository.createLedgerEntry(transaction.id, senderLedger.id, "DEBIT", input.amount, client);
      await ledgerRepository.createLedgerEntry(transaction.id, cashLedger.id, "CREDIT", input.amount, client);
      await ledgerRepository.createLedgerEntry(transaction.id, cashLedger.id, "DEBIT", input.amount, client);
      await ledgerRepository.createLedgerEntry(transaction.id, receiverLedger.id, "CREDIT", input.amount, client);
      await assertTransactionBalanced(transaction.id, client);

      return {
        transactionId: transaction.id,
        reference: transaction.reference,
      };
    });
  } catch (error) {
    if (
      error instanceof NotFoundError ||
      error instanceof ConflictError ||
      error instanceof InsufficientFundsError ||
      error instanceof AccountFrozenError ||
      error instanceof AccountClosedError
    ) {
      throw error;
    }

    throw new InternalServerError("Failed to process transfer.");
  }
}

export async function getAccountBalance(accountNumber: string, at?: Date): Promise<accountBalanceResult> {
  const bankAccount = await bankAccountRepository.findBankAccountByNumber(accountNumber);
  if (!bankAccount) {
    throw new NotFoundError("Bank account not found.");
  }

  const customerLedger = await ledgerRepository.findCustomerLedgerAccount(bankAccount.id);
  if (!customerLedger) {
    throw new NotFoundError("Customer ledger account not found.");
  }

  const balance = await ledgerRepository.calculateLedgerBalance(customerLedger.id, undefined, at);

  return {
    accountNumber: bankAccount.accountNumber,
    balance: balance,
    ...(at ? { asOf: at.toISOString() } : {}),
  };
}

export async function getAccountTransactions(
  accountNumber: string,
  page: number,
  limit: number,
  sort: "asc" | "desc" = "desc"
): Promise<transactionHistoryResult> {
  const bankAccount = await bankAccountRepository.findBankAccountByNumber(accountNumber);
  if (!bankAccount) {
    throw new NotFoundError("Bank account not found.");
  }

  const customerLedger = await ledgerRepository.findCustomerLedgerAccount(bankAccount.id);
  if (!customerLedger) {
    throw new NotFoundError("Customer ledger account not found.");
  }

  return ledgerRepository.findTransactionHistory(customerLedger.id, page, limit, sort);
}
