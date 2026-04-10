import type { NextFunction, Request, Response } from 'express';
import { type z } from 'zod';
import { createValidationAppError } from '../shared/errors/app-error.js';

function issuesToFieldErrors(
  issues: readonly { path: PropertyKey[]; message: string }[],
): Array<{ field: string; message: string }> {
  return issues.map((issue) => ({
    field: issue.path.map(String).join('.') || 'root',
    message: issue.message,
  }));
}

export function validateBody<S extends z.ZodType>(schema: S) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      next(createValidationAppError('Validation failed', issuesToFieldErrors(parsed.error.issues)));
      return;
    }
    req.body = parsed.data;
    next();
  };
}

export function validateQuery<S extends z.ZodType>(schema: S) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      next(createValidationAppError('Validation failed', issuesToFieldErrors(parsed.error.issues)));
      return;
    }
    req.query = parsed.data as Request['query'];
    next();
  };
}

export function validateParams<S extends z.ZodType>(schema: S) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.params);
    if (!parsed.success) {
      next(createValidationAppError('Validation failed', issuesToFieldErrors(parsed.error.issues)));
      return;
    }
    req.params = parsed.data as Request['params'];
    next();
  };
}
