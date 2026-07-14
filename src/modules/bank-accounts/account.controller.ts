import { Request, Response } from "express";
import { createAccountSchema, updateAccountSchema, updateAccountStatusSchema } from "./account.schema";
import { createAccount, deleteAccount, getAccountById, getAllAccounts, updateAccount, updateAccountStatus } from "./account.service";

export async function createAccountHandler(req: Request, res: Response): Promise<void> {
    const data = createAccountSchema.parse(req.body);
    const account = await createAccount(data);
    res.status(201).json({
        success: true,
        data: account,
    });
}

export async function getAccountByIdHandler(req: Request, res: Response): Promise<void> {
    const { accountId } = req.params;
    const account = await getAccountById(accountId as string);
    res.status(200).json({
        success: true,
        data: account,
    });
}

export async function getAllAccountsHandler(req: Request, res: Response): Promise<void> {
    const accounts = await getAllAccounts();
    res.status(200).json({
        success: true,
        data: accounts,
    });
}

export async function updateAccountHandler(req: Request, res: Response): Promise<void> {
    const { accountId } = req.params;
    const data = updateAccountSchema.parse(req.body);
    const account = await updateAccount(accountId as string, data);
    res.status(200).json({
        success: true,
        data: account,
    });
}

export async function deleteAccountHandler(req: Request, res: Response): Promise<void> {
    const { accountId } = req.params;
    await deleteAccount(accountId as string);
    res.status(200).json({
        success: true,
        data: null,
    });
}

export async function updateAccountStatusHandler(req: Request, res: Response): Promise<void> {
    const { accountNumber } = req.params;
    const data = updateAccountStatusSchema.parse(req.body);
    const account = await updateAccountStatus(accountNumber as string, data);
    res.status(200).json({
        success: true,
        data: account,
    });
}
