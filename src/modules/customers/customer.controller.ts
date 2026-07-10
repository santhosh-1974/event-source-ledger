import { Request, Response, NextFunction } from "express";
import { createCustomerSchema } from "./customer.schema";
import { createCustomer, getAllCustomers, getCustomerById } from "./customer.service";

export async function createCustomerHandler(req:Request,res:Response):Promise<void> {
    const data = createCustomerSchema.parse(req.body);
    const customer = await createCustomer(data);
    res.status(201).json({
      success: true,
      data: customer,
    });
}
export async function getCustomerByIdHandler(req: Request,res: Response): Promise<void> {
    const { customerId } = req.params;
    const customer = await getCustomerById(customerId as string);
    res.status(200).json({
      success: true,
      data: customer,
    });
}

export async function getAllCustomersHandler(req: Request,res: Response):Promise<void> {
    const customers = await getAllCustomers();
    res.status(200).json({
      success: true,
      data: customers,
    });

}