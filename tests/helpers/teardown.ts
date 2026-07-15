import { afterAll } from "vitest";

import { disconnectDatabase } from "./database";

afterAll(async () => {
  await disconnectDatabase();
});