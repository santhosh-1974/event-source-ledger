import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../helpers/app";
import { query } from "../../src/database/database";

const BASE_URL = "/api/v1/customers";

async function customerCount(): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM customers`
  );

  return Number(result.rows[0].count);
}

describe("Customer API", () => {
  it("should create a customer", async () => {
    const payload = {
      name: "Santhosh",
      email: "santhosh@gmail.com",
      phone: "9876543210",
    };

    const response = await request(app)
      .post(`${BASE_URL}/create-customer`)
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    expect(response.body.data).toMatchObject({
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
    });

    expect(await customerCount()).toBe(1);

    const dbCustomer = await query<{
      name: string;
      email: string;
      phone: string;
    }>(
      `
      SELECT name,email,phone
      FROM customers
      WHERE email=$1
      `,
      [payload.email]
    );

    expect(dbCustomer.rows[0]).toEqual(payload);
  });

  it("should not allow duplicate email", async () => {
    const payload = {
      name: "Santhosh",
      email: "santhosh@gmail.com",
      phone: "9876543210",
    };

    await request(app)
      .post(`${BASE_URL}/create-customer`)
      .send(payload);

    const response = await request(app)
      .post(`${BASE_URL}/create-customer`)
      .send({
        ...payload,
        phone: "9999999999",
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Email already exists");

    expect(await customerCount()).toBe(1);
  });

  it("should not allow duplicate phone number", async () => {
    const payload = {
      name: "Santhosh",
      email: "santhosh@gmail.com",
      phone: "9876543210",
    };

    await request(app)
      .post(`${BASE_URL}/create-customer`)
      .send(payload);

    const response = await request(app)
      .post(`${BASE_URL}/create-customer`)
      .send({
        ...payload,
        email: "another@gmail.com",
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Phone number already exists");

    expect(await customerCount()).toBe(1);
  });

  it("should reject invalid email", async () => {
    const response = await request(app)
      .post(`${BASE_URL}/create-customer`)
      .send({
        name: "Santhosh",
        email: "invalid-email",
        phone: "9876543210",
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);

    expect(await customerCount()).toBe(0);
  });

  it("should reject invalid phone number", async () => {
    const response = await request(app)
      .post(`${BASE_URL}/create-customer`)
      .send({
        name: "Santhosh",
        email: "santhosh@gmail.com",
        phone: "12345",
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);

    expect(await customerCount()).toBe(0);
  });

  it("should reject missing required fields", async () => {
    const response = await request(app)
      .post(`${BASE_URL}/create-customer`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);

    expect(await customerCount()).toBe(0);
  });

  it("should trim name, phone and lowercase email", async () => {
    const response = await request(app)
      .post(`${BASE_URL}/create-customer`)
      .send({
        name: "  Santhosh  ",
        email: "SANTHOSH@GMAIL.COM",
        phone: " 9876543210 ",
      });

    expect(response.status).toBe(201);

    expect(response.body.data.name).toBe("Santhosh");
    expect(response.body.data.email).toBe("santhosh@gmail.com");
    expect(response.body.data.phone).toBe("9876543210");
  });

  it("should reject name shorter than 3 characters", async () => {
    const response = await request(app)
      .post(`${BASE_URL}/create-customer`)
      .send({
        name: "ab",
        email: "ab@gmail.com",
        phone: "9876543210",
      });

    expect(response.status).toBe(400);
    expect(await customerCount()).toBe(0);
  });
});