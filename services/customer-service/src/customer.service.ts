import {
  createCustomer as insertCustomer,
  Customer,
  findCustomerById,
  updateCustomer as updateCustomerRecord,
} from "./customer.repository";
import { CreateCustomerInput, UpdateCustomerInput } from "./customer.schema";
import { ConflictError, NotFoundError } from "./errors/errors";

function isUniqueViolation(
  error: unknown
): error is { code: "23505"; constraint: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505" &&
    "constraint" in error &&
    typeof error.constraint === "string"
  );
}

export async function createCustomer(
  data: CreateCustomerInput
): Promise<Customer> {
  try {
    return await insertCustomer(data);
  } catch (error) {
    if (isUniqueViolation(error)) {
      if (error.constraint === "customers_email_key") {
        throw new ConflictError("Email already exists");
      }
      if (error.constraint === "customers_phone_key") {
        throw new ConflictError("Phone number already exists");
      }
    }
    throw error;
  }
}

export async function getCustomerById(id: string): Promise<Customer> {
  const customer = await findCustomerById(id);
  if (!customer) {
    throw new NotFoundError("Customer not found.");
  }
  return customer;
}

export async function updateCustomerProfile(
  id: string,
  data: UpdateCustomerInput
): Promise<Customer> {
  try {
    const customer = await updateCustomerRecord(id, data);
    if (!customer) {
      throw new NotFoundError("Customer not found.");
    }
    return customer;
  } catch (error) {
    if (isUniqueViolation(error) && error.constraint === "customers_phone_key") {
      throw new ConflictError("Phone number already exists");
    }
    throw error;
  }
}
