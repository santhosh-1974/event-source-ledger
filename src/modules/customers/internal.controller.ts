import { Request, Response } from "express";
import { createCustomerSchema } from "./customer.schema";
import { createCustomer } from "./customer.service";

/**
 * POST /api/v1/internal/customers
 *
 * Protected internal endpoint used by the Identity Service to provision a
 * Customer record after a successful user registration.
 * Authentication is handled by the secret-checking middleware in internal.routes.ts.
 */
export async function createInternalCustomerHandler(
  req: Request,
  res: Response
): Promise<void> {
  const input = createCustomerSchema.parse(req.body);
  const customer = await createCustomer(input);
  res.status(201).json({ success: true, data: customer });
}
