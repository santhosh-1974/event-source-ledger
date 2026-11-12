import { QueryResultRow } from "pg";

import { query } from "./database/database";
import { CreateCustomerInput, UpdateCustomerInput } from "./customer.schema";

interface CustomerRow extends QueryResultRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  created_at: Date;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: Date;
}

const CUSTOMER_FIELDS = "id, name, email, phone, created_at";

function mapCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    createdAt: row.created_at,
  };
}

export async function createCustomer(data: CreateCustomerInput): Promise<Customer> {
  const result = await query<CustomerRow>(
    `INSERT INTO customer.customers (name, email, phone)
     VALUES ($1, $2, $3)
     RETURNING ${CUSTOMER_FIELDS}`,
    [data.name, data.email, data.phone]
  );
  return mapCustomer(result.rows[0]);
}

export async function findCustomerById(id: string): Promise<Customer | null> {
  const result = await query<CustomerRow>(
    `SELECT ${CUSTOMER_FIELDS}
     FROM customer.customers
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] ? mapCustomer(result.rows[0]) : null;
}

export async function updateCustomer(
  id: string,
  data: UpdateCustomerInput
): Promise<Customer | null> {
  const result = await query<CustomerRow>(
    `UPDATE customer.customers
     SET name = COALESCE($2, name),
         phone = COALESCE($3, phone)
     WHERE id = $1
     RETURNING ${CUSTOMER_FIELDS}`,
    [id, data.name ?? null, data.phone ?? null]
  );
  return result.rows[0] ? mapCustomer(result.rows[0]) : null;
}
