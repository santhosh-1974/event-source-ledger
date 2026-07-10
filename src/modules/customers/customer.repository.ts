import { query } from "../../database/database";
import { CreateCustomerInput } from "./customer.schema";
import { Customer } from "./customer.types";

interface CustomerRow {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  created_at: Date;
}

function mapCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    createdAt: row.created_at,
  };
}

export async function create(data: CreateCustomerInput):Promise<Customer> {
  const result = await query<CustomerRow>(
    `
      INSERT INTO customers (full_name,email,phone)
      VALUES ($1, $2, $3)
      RETURNING id,full_name,email,phone,created_at;
    `,
    [
      data.fullName,
      data.email,
      data.phone,
    ]
  );
  return mapCustomer(result.rows[0]);
}

export async function findById(id: string): Promise<Customer|null> {
  const result = await query<CustomerRow>(
    `
      SELECT id,full_name,email,phone,created_at FROM customers
      WHERE id = $1;
    `,
    [id]
  );
    if(result.rowCount === 0)return null;
    return mapCustomer(result.rows[0]);
}

export async function findByEmail(email: string):Promise<Customer|null> {
  const result = await query<CustomerRow>(
    `
      SELECT id,full_name,email,phone,created_at FROM customers
      WHERE email = $1;
    `,
    [email]
  );

  if (result.rowCount === 0)return null;
  return mapCustomer(result.rows[0]);
}

export async function findByPhone(phone: string): Promise<Customer | null> {
  const result = await query<CustomerRow>(
    `
      SELECT id,full_name,email,phone,created_at FROM customers
      WHERE phone = $1;
    `,
    [phone]
  );

  if(result.rowCount === 0)return null;
  return mapCustomer(result.rows[0]);
}

export async function findAll(): Promise<Customer[]> {
  const result = await query<CustomerRow>(
    `
      SELECT id,full_name,email,phone,created_at FROM customers
      ORDER BY created_at DESC;
    `
  );
  return result.rows.map(mapCustomer);
}