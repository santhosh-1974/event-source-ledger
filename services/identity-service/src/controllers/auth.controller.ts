import { Request, Response, NextFunction } from "express";

import { loginSchema, registerSchema } from "../auth.schema";
import { login, register } from "../services/auth.service";

export async function registerHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = registerSchema.parse(req.body);
    const result = await register(input);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function loginHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = loginSchema.parse(req.body);
    const result = await login(input);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
