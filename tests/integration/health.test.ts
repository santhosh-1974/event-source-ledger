import { performance } from "node:perf_hooks";
import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../helpers/app";
import { pool } from "../../src/database/database";

function expectIsoTimestamp(value: unknown): void {
  expect(typeof value).toBe("string");
  expect(new Date(value as string).toISOString()).toBe(value);
}

describe("Health Check API", () => {
  it("should report application health without checking dependencies", async () => {
    const startedAt = performance.now();
    const response = await request(app).get("/health");
    const elapsed = performance.now() - startedAt;

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.body.success).toBe(true);
    expect(response.body.status).toBe("UP");
    expectIsoTimestamp(response.body.timestamp);
    expect(elapsed).toBeLessThan(100);
  });

  it("should report readiness when PostgreSQL is connected", async () => {
    const startedAt = performance.now();
    const response = await request(app).get("/ready");
    const elapsed = performance.now() - startedAt;

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.body).toMatchObject({
      success: true,
      status: "UP",
      dependencies: { database: "UP" },
    });
    expectIsoTimestamp(response.body.timestamp);
    expect(elapsed).toBeLessThan(1_000);
  });

  it("should report readiness DOWN after the database pool is disconnected while health remains UP", async () => {
    await pool.end();

    const readiness = await request(app).get("/ready");
    const health = await request(app).get("/health");

    expect(readiness.status).toBe(503);
    expect(readiness.body).toMatchObject({
      success: false,
      status: "DOWN",
      dependencies: { database: "DOWN" },
    });
    expectIsoTimestamp(readiness.body.timestamp);
    expect(health.status).toBe(200);
    expect(health.body.status).toBe("UP");
  });
});
