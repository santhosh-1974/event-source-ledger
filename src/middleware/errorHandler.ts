import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { logger } from "../config/logger";
import { ApiError } from "../errors/errors";

export function errorHandler(err: unknown,req: Request,res: Response,next: NextFunction):void{
  if (err instanceof ApiError) {
    logger.warn({err,method: req.method,url: req.originalUrl,},err.message);
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  if (err instanceof ZodError) {
    logger.warn({err,method: req.method,url: req.originalUrl,},"Validation Error");
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: err.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }


  logger.error({err,method: req.method,url: req.originalUrl},"Unexpected Server Error");
  res.status(500).json({
    success: false,
    message: "Internal Server Error",
  });
}