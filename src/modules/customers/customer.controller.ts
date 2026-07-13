import { NextFunction, Request, Response } from "express";
import { createCustomerSchema } from "./customer.schema";
import { createCustomer, getAllCustomers, getCustomerById } from "./customer.service";

export async function createCustomerHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = createCustomerSchema.parse(req.body);
    const customer = await createCustomer(data);
    res.status(201).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    next(error);
  }
}

export async function getCustomerByIdHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { customerId } = req.params;
    const customer = await getCustomerById(customerId as string);
    res.status(200).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    next(error);
  }
}

export async function getAllCustomersHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const customers = await getAllCustomers();
    res.status(200).json({
      success: true,
      data: customers,
    });
  } catch (error) {
    next(error);
  }
}