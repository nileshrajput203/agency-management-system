import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  field?: string;
}

export function createError(message: string, statusCode = 400, code?: string, field?: string): AppError {
  const err: AppError = new Error(message);
  err.statusCode = statusCode;
  if (code) err.code = code;
  if (field) err.field = field;
  return err;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const status = err.statusCode ?? 500;
  const userId = (req as any).userId;

  if (status >= 500) {
    logger.error(
      {
        err,
        cause: (err as any).cause,
        stack: err.stack,
        method: req.method,
        url: req.url,
        userId,
        statusCode: status,
      },
      "Unhandled error"
    );
  } else {
    logger.warn(
      {
        message: err.message,
        method: req.method,
        url: req.url,
        userId,
        statusCode: status,
      },
      "Client error"
    );
  }

  res.status(status).json({
    error: err.message || "Internal server error",
    ...(err.code ? { code: err.code } : {}),
    ...(err.field ? { field: err.field, message: err.message } : {}),
  });
}
