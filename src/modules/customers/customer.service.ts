import { ConflictError, NotFoundError } from "../../errors/errors";
import { create, findAll, findByEmail, findById, findByPhone } from "./customer.repository";
import { CreateCustomerInput } from "./customer.schema";
import { Customer } from "./customer.types";

export async function createCustomer(data: CreateCustomerInput):Promise<Customer> {
  const existingEmail = await findByEmail(data.email);
  if (existingEmail)throw new ConflictError("Email already exists");
  const existingPhone = await findByPhone(data.phone);
  if(existingPhone)throw new ConflictError("Phone number already exists");
  return create(data);
}
export async function getCustomerById(customerId: string): Promise<Customer> {
  const customer = await findById(customerId);
  if (!customer)throw new NotFoundError("Customer not found.");
  return customer;
}
export async function getAllCustomers(): Promise<Customer[]> {
  return findAll();
}