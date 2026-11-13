import { NotFoundError } from "../../errors/errors";
import { Request, Response } from "express";
import { accountParamsSchema, createAccountSchema } from "./account.schema";
import { createAccount, getAccountById, getAllAccounts } from "./account.service";

export async function createAccountHandler(req: Request, res: Response): Promise<void> {
    const data = createAccountSchema.parse(req.body);
    if (data.customerId !== req.auth!.customerId) {
        throw new NotFoundError("Customer not found.");
    }
    const account = await createAccount(data);
    res.status(201).json({ success: true, data: account });
}

export async function getAccountByIdHandler(req: Request, res: Response): Promise<void> {
    const { accountId } = accountParamsSchema.parse(req.params);
    const account = await getAccountById(accountId, req.auth!.customerId);
    res.status(200).json({ success: true, data: account });
}

export async function getAllAccountsHandler(req: Request, res: Response): Promise<void> {
    const accounts = await getAllAccounts(req.auth!.customerId);
    res.status(200).json({ success: true, data: accounts });
}