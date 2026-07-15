import { Request, Response } from "express";
import { getHealthStatus, getReadinessStatus } from "./health.service";

export function healthHandler(_req: Request, res: Response): void {
  res.status(200).json(getHealthStatus());
}

export async function readinessHandler(_req: Request, res: Response): Promise<void> {
  try {
    res.status(200).json(await getReadinessStatus());
  } catch {
    res.status(503).json({
      success: false,
      status: "DOWN",
      timestamp: new Date().toISOString(),
      dependencies: { database: "DOWN" },
    });
  }
}
