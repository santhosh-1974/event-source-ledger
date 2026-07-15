import { pool } from "../database/database";

export function getHealthStatus(): { success: true; status: "UP"; timestamp: string } {
  return { success: true, status: "UP", timestamp: new Date().toISOString() };
}

export async function getReadinessStatus(): Promise<{
  success: true;
  status: "UP";
  timestamp: string;
  dependencies: { database: "UP" };
}> {
  await pool.query("SELECT 1");
  return {
    success: true,
    status: "UP",
    timestamp: new Date().toISOString(),
    dependencies: { database: "UP" },
  };
}
