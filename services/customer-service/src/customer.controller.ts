import { Request, Response } from "express";
import { z } from "zod";

import {
  createCustomerSchema,
  updateCustomerSchema,
} from "./customer.schema";
import {
  createCustomer,
  getCustomerById,
  updateCustomerProfile,
} from "./customer.service";
import { NotFoundError } from "./errors/errors";

export async function createCustomerHandler(
  req: Request,
  res: Response
): Promise<void> {
  const input = createCustomerSchema.parse(req.body);
  const customer = await createCustomer(input);
  res.status(201).json({ success: true, data: customer });
}

export async function getCurrentCustomerHandler(
  req: Request,
  res: Response
): Promise<void> {
  const customer = await getCustomerById(req.customerId!);
  res.status(200).json({ success: true, data: customer });
}

export async function getCustomerByIdHandler(
  req: Request,
  res: Response
): Promise<void> {
  const customerId = z.uuid().parse(req.params.customerId);
  if (customerId !== req.customerId) {
    throw new NotFoundError("Customer not found.");
  }
  const customer = await getCustomerById(customerId);
  res.status(200).json({ success: true, data: customer });
}

export async function updateCurrentCustomerHandler(
  req: Request,
  res: Response
): Promise<void> {
  const input = updateCustomerSchema.parse(req.body);
  const customer = await updateCustomerProfile(req.customerId!, input);
  res.status(200).json({ success: true, data: customer });
}

export async function updateCustomerByIdHandler(
  req: Request,
  res: Response
): Promise<void> {
  const customerId = z.uuid().parse(req.params.customerId);
  if (customerId !== req.customerId) {
    throw new NotFoundError("Customer not found.");
  }
  const input = updateCustomerSchema.parse(req.body);
  const customer = await updateCustomerProfile(customerId, input);
  res.status(200).json({ success: true, data: customer });
}

export async function getCustomerExistenceHandler(
  req: Request,
  res: Response
): Promise<void> {
  const customerId = z.uuid().parse(req.params.customerId);
  const customer = await getCustomerById(customerId);
  res.status(200).json({ success: true, data: { id: customer.id } });
}

export async function getCustomerContactHandler(
  req: Request,
  res: Response
): Promise<void> {
  const customerId = z.uuid().parse(req.params.customerId);
  const customer = await getCustomerById(customerId);
  res.status(200).json({
    success: true,
    data: { id: customer.id, email: customer.email },
  });
}
