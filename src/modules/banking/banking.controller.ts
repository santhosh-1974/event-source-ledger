import { Request, Response } from "express";
import { deposit, getAccountBalance, getAccountTransactions, transfer, withdraw } from "./banking.service";
import { depositInputSchema, transferInputSchema, withdrawInputSchema } from "./banking.schmea";
import { IdempotencyRequest } from "../../middleware/idempotency.middleware";

export async function depositHandler(req: Request, res: Response): Promise<void> {
    const data = depositInputSchema.parse(req.body);
    const idempotencyKey = (req as IdempotencyRequest).idempotencyKey;
    const result = await deposit(data, idempotencyKey);
    res.status(201).json({
        success: true,
        data: result,
    });
}

export async function withdrawHandler(req: Request, res: Response): Promise<void> {
    const data = withdrawInputSchema.parse(req.body);
    const idempotencyKey = (req as IdempotencyRequest).idempotencyKey;
    const result = await withdraw(data, idempotencyKey);
    res.status(201).json({
        success: true,
        data: result,
    });
}

export async function transferHandler(req: Request, res: Response): Promise<void> {
    const data = transferInputSchema.parse(req.body);
    const idempotencyKey = (req as IdempotencyRequest).idempotencyKey;
    const result = await transfer(data, idempotencyKey);
    res.status(201).json({
        success: true,
        data: result,
    });
}

export async function getAccountBalanceHandler(req: Request, res: Response): Promise<void> {
    const { accountNumber } = req.params;
    const normalizedAccountNumber = Array.isArray(accountNumber) ? accountNumber[0] : accountNumber;
    const result = await getAccountBalance(normalizedAccountNumber);
    res.status(200).json({
        success: true,
        data: result,
    });
}

export async function getAccountTransactionsHandler(req: Request, res: Response): Promise<void> {
    const { accountNumber } = req.params;
    const normalizedAccountNumber = Array.isArray(accountNumber) ? accountNumber[0] : accountNumber;
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const result = await getAccountTransactions(normalizedAccountNumber, page, limit);
    res.status(200).json({
        success: true,
        data: result,
    });
}
