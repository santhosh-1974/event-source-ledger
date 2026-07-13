import { randomUUID } from "crypto";

import { getClient } from "../../database/database";
import { ConflictError, InsufficientFundsError, InternalServerError, NotFoundError } from "../../errors/errors";

import * as bankAccountRepository from "../bank-accounts/account.repository";
import * as ledgerRepository from "../ledger/ledger.respository";
import * as transactionRepository from "../transactions/transaction.repository";

import { depositInput, transferInput, withdrawInput } from "./banking.schmea";
import { accountBalanceResult, depositResult, transferResult, transactionHistoryResult, withdrawResult } from "./banking.types";

const SYSTEM_CASH_LEDGER_NAME = "Cash";
const WITHDRAWAL_DESCRIPTION = "Cash Withdrawal";
const TRANSFER_DESCRIPTION_PREFIX = "Transfer";

export async function deposit(input: depositInput): Promise<depositResult> {
  const client = await getClient();
  try {
    await client.query("BEGIN");

    const bankAccount = await bankAccountRepository.findBankAccountByNumber(input.accountNumber, client);
    if (!bankAccount) {
      throw new NotFoundError("Bank account not found.");
    }

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
    await client.query("COMMIT");

    return {
      transactionId: transaction.id,
      reference: transaction.reference,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function withdraw(input: withdrawInput): Promise<withdrawResult> {
  const client = await getClient();

  try {
    await client.query("BEGIN");

    const lockedAccount = await bankAccountRepository.findBankAccountByNumberForUpdate(input.accountNumber, client);
    if (!lockedAccount) {
      throw new NotFoundError("Bank account not found.");
    }

    const customerLedger = await ledgerRepository.findCustomerLedgerAccount(lockedAccount.id, client);
    if (!customerLedger) {
      throw new NotFoundError("Customer ledger account not found.");
    }

    const cashLedger = await ledgerRepository.findSystemLedgerAccount(SYSTEM_CASH_LEDGER_NAME, client);
    if (!cashLedger) {
      throw new NotFoundError("Cash ledger account not found.");
    }

    const balance = await ledgerRepository.calculateLedgerBalance(customerLedger.id, client);
    const availableBalance = Number(balance);
    const withdrawalAmount = Number(input.amount);

    if (availableBalance < withdrawalAmount) {
      throw new InsufficientFundsError("Insufficient funds for withdrawal.");
    }

    const reference = randomUUID();
    const transaction = await transactionRepository.create(reference, WITHDRAWAL_DESCRIPTION, client);

    await ledgerRepository.createLedgerEntry(transaction.id, customerLedger.id, "DEBIT", input.amount, client);
    await ledgerRepository.createLedgerEntry(transaction.id, cashLedger.id, "CREDIT", input.amount, client);

    await client.query("COMMIT");

    return {
      transactionId: transaction.id,
      reference: transaction.reference,
    };
  } catch (error) {
    await client.query("ROLLBACK");

    if (error instanceof NotFoundError || error instanceof InsufficientFundsError) {
      throw error;
    }

    throw new InternalServerError("Failed to process withdrawal.");
  } finally {
    client.release();
  }
}

export async function transfer(input: transferInput): Promise<transferResult> {
  const client = await getClient();

  try {
    await client.query("BEGIN");

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

    const senderLedger = await ledgerRepository.findCustomerLedgerAccount(senderAccountId, client);
    const receiverLedger = await ledgerRepository.findCustomerLedgerAccount(receiverAccountId, client);

    if (!senderLedger || !receiverLedger) {
      throw new NotFoundError("Customer ledger account not found.");
    }

    const senderBalance = await ledgerRepository.calculateLedgerBalance(senderLedger.id, client);
    const transferAmount = Number(input.amount);

    if (Number(senderBalance) < transferAmount) {
      throw new InsufficientFundsError("Insufficient funds for transfer.");
    }

    const reference = randomUUID();
    const description = input.description?.trim() || TRANSFER_DESCRIPTION_PREFIX;
    const transaction = await transactionRepository.create(reference, description, client);

    await ledgerRepository.createLedgerEntry(transaction.id, senderLedger.id, "DEBIT", input.amount, client);
    await ledgerRepository.createLedgerEntry(transaction.id, receiverLedger.id, "CREDIT", input.amount, client);

    const debitTotal = await ledgerRepository.calculateLedgerEntryTotal(transaction.id, client, "DEBIT");
    const creditTotal = await ledgerRepository.calculateLedgerEntryTotal(transaction.id, client, "CREDIT");

    if (Number(debitTotal) !== Number(creditTotal)) {
      throw new InternalServerError("Transfer entries are not balanced.");
    }

    await client.query("COMMIT");

    return {
      transactionId: transaction.id,
      reference: transaction.reference,
    };
  } catch (error) {
    await client.query("ROLLBACK");

    if (error instanceof NotFoundError || error instanceof ConflictError || error instanceof InsufficientFundsError) {
      throw error;
    }

    throw new InternalServerError("Failed to process transfer.");
  } finally {
    client.release();
  }
}

export async function getAccountBalance(accountNumber: string): Promise<accountBalanceResult> {
  const bankAccount = await bankAccountRepository.findBankAccountByNumber(accountNumber);
  if (!bankAccount) {
    throw new NotFoundError("Bank account not found.");
  }

  const customerLedger = await ledgerRepository.findCustomerLedgerAccount(bankAccount.id);
  if (!customerLedger) {
    throw new NotFoundError("Customer ledger account not found.");
  }

  const balance = await ledgerRepository.calculateLedgerBalance(customerLedger.id);

  return {
    accountNumber: bankAccount.accountNumber,
    balance: balance,
  };
}

export async function getAccountTransactions(accountNumber: string, page: number, limit: number): Promise<transactionHistoryResult> {
  const bankAccount = await bankAccountRepository.findBankAccountByNumber(accountNumber);
  if (!bankAccount) {
    throw new NotFoundError("Bank account not found.");
  }

  const customerLedger = await ledgerRepository.findCustomerLedgerAccount(bankAccount.id);
  if (!customerLedger) {
    throw new NotFoundError("Customer ledger account not found.");
  }

  return ledgerRepository.findTransactionHistory(customerLedger.id, page, limit);
}