import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/app-error.js';
import { logger } from '../utils/logger.js';

export function globalErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    logger.warn(err.message, {
      code: err.code,
      statusCode: err.statusCode,
      errors: err.errors,
    });
    const body: Record<string, unknown> = {
      success: false,
      code: err.code,
      message: err.message,
    };
    if (err.errors !== undefined && err.errors.length > 0) {
      body.errors = err.errors;
    }
    res.status(err.statusCode).json(body);
    return;
  }
  const message = err instanceof Error ? err.message : 'Unknown error';
  logger.error('Unhandled error', { message });
  res.status(500).json({
    success: false,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
  });
}
