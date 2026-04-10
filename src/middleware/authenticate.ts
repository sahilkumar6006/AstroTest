import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../shared/errors/app-error.js';
import { verifyAccess } from '../utils/jwt.js';

export type AuthenticatedRequest = Request & {
  user: {
    userId: string;
    role: string;
  };
};

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token');
    }
    const token = header.slice('Bearer '.length);
    const payload = verifyAccess(token);
    (req as AuthenticatedRequest).user = { userId: payload.sub, role: payload.role };
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
  }
}
