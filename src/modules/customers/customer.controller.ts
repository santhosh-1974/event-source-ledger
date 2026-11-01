import { Request, Response } from "express";

import { NotFoundError } from "../../errors/errors";
import { getCustomerById } from "./customer.service";

export async function getCurrentCustomerHandler(req: Request, res: Response): Promise<void> {
  const customer = await getCustomerById(req.auth!.customerId);
  res.status(200).json({ success: true, data: customer });
}

export async function getCustomerByIdHandler(req: Request, res: Response): Promise<void> {
  const { customerId } = req.params;
  if (customerId !== req.auth!.customerId) {
    throw new NotFoundError("Customer not found.");
  }
  const customer = await getCustomerById(customerId);
  res.status(200).json({ success: true, data: customer });
}