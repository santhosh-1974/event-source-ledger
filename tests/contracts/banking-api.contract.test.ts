import { describe, expect, it } from "vitest";
import { openApiSpec } from "../../src/docs/openAPI";

describe("Banking Core API v1 OpenAPI contract", () => {
  it("documents the versioned Gateway endpoints and bearer authentication", () => {
    expect(openApiSpec.info.version).toBe("1.0.0");
    expect(openApiSpec.servers[0].url).toBe(
      "http://localhost:4000/api/v1"
    );
    expect(openApiSpec.security).toEqual([{ BearerAuth: [] }]);
    expect(openApiSpec.paths["/accounts"]).toHaveProperty("get");
    expect(openApiSpec.paths["/accounts/{accountId}"]).toHaveProperty("get");
    expect(openApiSpec.paths["/banking/deposit"]).toHaveProperty("post");
    expect(openApiSpec.paths["/banking/withdraw"]).toHaveProperty("post");
    expect(openApiSpec.paths["/banking/transfer"]).toHaveProperty("post");
    expect(
      openApiSpec.paths["/banking/{accountNumber}/balance"]
    ).toHaveProperty("get");
    expect(
      openApiSpec.paths["/banking/{accountNumber}/history"]
    ).toHaveProperty("get");
    expect(openApiSpec.paths["/transactions/{transactionId}"]).toHaveProperty(
      "get"
    );
  });

  it("requires bearer auth and an idempotency key for financial writes", () => {
    const transfer = openApiSpec.paths["/banking/transfer"].post;

    expect(transfer.security).toEqual([
      { BearerAuth: [], IdempotencyKey: [] },
    ]);
    expect(transfer.parameters).toContainEqual({
      $ref: "#/components/parameters/IdempotencyKey",
    });
    expect(transfer.responses).toHaveProperty("201");
    expect(transfer.responses).toHaveProperty("400");
    expect(transfer.responses).toHaveProperty("401");
    expect(transfer.responses).toHaveProperty("404");
    expect(transfer.responses).toHaveProperty("409");
  });
});
