import { createServer } from "node:http";
import dotenv from "dotenv";
import { afterAll, beforeAll } from "vitest";

dotenv.config({
  path: process.env.NODE_ENV === "test" ? ".env.test" : ".env",
  override: false,
});

process.env.POSTGRES_HOST = process.env.DATABASE_HOST;
process.env.POSTGRES_PORT = process.env.DATABASE_PORT;
process.env.POSTGRES_DB = process.env.DATABASE_NAME;
process.env.POSTGRES_USER = process.env.DATABASE_USER;
process.env.POSTGRES_PASSWORD = process.env.DATABASE_PASSWORD;
if (!process.env.CUSTOMER_PROVISIONING_SECRET) {
  process.env.CUSTOMER_PROVISIONING_SECRET =
    "integration-test-only-customer-provisioning-secret";
}
process.env.NOTIFICATION_CUSTOMER_LOOKUP_SECRET ??=
  "integration-test-only-notification-contact-secret";
process.env.NOTIFICATION_CONSUMER_ENABLED ??= "false";
process.env.NOTIFICATION_SES_ENABLED ??= "false";
process.env.NOTIFICATION_SQS_QUEUE_URL ??= "";
process.env.NOTIFICATION_SES_FROM_EMAIL ??= "";

const { default: customerServiceApp } = await import(
  "../../services/customer-service/src/app"
);
const { pool: customerServicePool } = await import(
  "../../services/customer-service/src/database/database"
);
const customerServer = createServer(customerServiceApp);
await new Promise<void>((resolve, reject) => {
  customerServer.once("error", reject);
  customerServer.listen(0, "127.0.0.1", resolve);
});

const address = customerServer.address();
if (!address || typeof address === "string") {
  throw new Error("Could not determine the Customer Service test port");
}

process.env.CUSTOMER_SERVICE_URL = `http://127.0.0.1:${address.port}`;

const { default: identityServiceApp } = await import(
  "../../services/identity-service/src/app"
);
const { pool: identityServicePool } = await import(
  "../../services/identity-service/src/database/database"
);
const identityServiceServer = createServer(identityServiceApp);
await new Promise<void>((resolve, reject) => {
  identityServiceServer.once("error", reject);
  identityServiceServer.listen(0, "127.0.0.1", resolve);
});

const identityAddress = identityServiceServer.address();
if (!identityAddress || typeof identityAddress === "string") {
  throw new Error("Could not determine the Identity Service test port");
}
process.env.IDENTITY_SERVICE_URL = `http://127.0.0.1:${identityAddress.port}`;

const { default: notificationServiceApp } = await import(
  "../../services/notification-service/src/app"
);
const { pool: notificationServicePool } = await import(
  "../../services/notification-service/src/database/database"
);
const notificationServer = createServer(notificationServiceApp);
await new Promise<void>((resolve, reject) => {
  notificationServer.once("error", reject);
  notificationServer.listen(0, "127.0.0.1", resolve);
});

const notificationAddress = notificationServer.address();
if (!notificationAddress || typeof notificationAddress === "string") {
  throw new Error("Could not determine the Notification Service test port");
}
process.env.NOTIFICATION_SERVICE_URL =
  `http://127.0.0.1:${notificationAddress.port}`;

const { default: bankingApp } = await import("../../src/app");
const bankingServer = createServer(bankingApp);
await new Promise<void>((resolve, reject) => {
  bankingServer.once("error", reject);
  bankingServer.listen(0, "127.0.0.1", resolve);
});

const bankingAddress = bankingServer.address();
if (!bankingAddress || typeof bankingAddress === "string") {
  throw new Error("Could not determine the Banking Core test port");
}

process.env.BANKING_SERVICE_URL = `http://127.0.0.1:${bankingAddress.port}`;

const {
  connectDatabase,
  assertTestEnvironment,
} = await import("./database");

beforeAll(async () => {
  assertTestEnvironment();
  await connectDatabase();
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    identityServiceServer.close((error) =>
      error ? reject(error) : resolve()
    );
  });
  await new Promise<void>((resolve, reject) => {
    notificationServer.close((error) =>
      error ? reject(error) : resolve()
    );
  });
  await new Promise<void>((resolve, reject) => {
    bankingServer.close((error) =>
      error ? reject(error) : resolve()
    );
  });
  await new Promise<void>((resolve, reject) => {
    customerServer.close((error) =>
      error ? reject(error) : resolve()
    );
  });
  await notificationServicePool.end();
  await customerServicePool.end();
  await identityServicePool.end();
});