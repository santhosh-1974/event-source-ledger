import { PoolClient } from "pg";
import { pool } from "../../database/database";
import { CreateCustomerInput } from "./customer.schema";
import { Customer } from "./customer.types";

interface CustomerRow {
    id: string;
    name: string;
    email: string;
    phone: string;
    created_at: Date;
}

function mapCustomer(row: CustomerRow): Customer {
    return {
        id: row.id,
        fullName: row.name,
        email: row.email,
        phone: row.phone,
        createdAt: row.created_at,
    };
}

export async function create(data: CreateCustomerInput, client?: PoolClient): Promise<Customer> {
    console.log("4")
    const db = client ?? pool;
    const result = await db.query<CustomerRow>(
        `
      INSERT INTO customers (name,email,phone)
      VALUES ($1, $2, $3)
      RETURNING id,name,email,phone,created_at;
    `,
        [
            data.name,
            data.email,
            data.phone,
        ]
    );
    console.log("5")
    return mapCustomer(result.rows[0]);
}

export async function findById(id: string, client?: PoolClient): Promise<Customer | null> {
    const db = client ?? pool;
    const result = await db.query<CustomerRow>(
        `
      SELECT id,name,email,phone,created_at FROM customers
      WHERE id = $1;
    `,
        [id]
    );
    if (result.rowCount === 0) return null;
    return mapCustomer(result.rows[0]);
}

export async function findByEmail(email: string, client?: PoolClient): Promise<Customer | null> {
    const db = client ?? pool;
    const result = await db.query<CustomerRow>(
        `
      SELECT id,name,email,phone,created_at FROM customers
      WHERE email = $1;
    `,
        [email]
    );

    if (result.rowCount === 0) return null;
    return mapCustomer(result.rows[0]);
}

export async function findByPhone(phone: string, client?: PoolClient): Promise<Customer | null> {
    const db = client ?? pool;
    const result = await db.query<CustomerRow>(
        `
      SELECT id,name,email,phone,created_at FROM customers
      WHERE phone = $1;
    `,
        [phone]
    );

    if (result.rowCount === 0) return null;
    return mapCustomer(result.rows[0]);
}

export async function findAll(client?: PoolClient): Promise<Customer[]> {
    const db = client ?? pool;
    const result = await db.query<CustomerRow>(
        `
      SELECT id,name,email,phone,created_at FROM customers
      ORDER BY created_at DESC;
    `
    );
    return result.rows.map(mapCustomer);
}