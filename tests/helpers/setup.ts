import { beforeAll } from "vitest";

import { connectDatabase, assertTestEnvironment } from "./database";

beforeAll(async () => {
  assertTestEnvironment();

  await connectDatabase();
});