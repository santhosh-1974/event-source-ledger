import { Request, Response } from "express";

import { loginSchema, registerSchema } from "./auth.schema";
import { login, register } from "./auth.service";

export async function registerHandler(req: Request, res: Response): Promise<void> {
  const input = registerSchema.parse(req.body);
  const result = await register(input);
  res.status(201).json({ success: true, data: result });
}

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const input = loginSchema.parse(req.body);
  const result = await login(input);
  res.status(200).json({ success: true, data: result });
}
