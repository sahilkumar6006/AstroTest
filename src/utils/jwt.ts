import jwt, { type SignOptions } from 'jsonwebtoken';
import { config } from '../config/app.config.js';

function getAccessSecret(): string {
  return config.require('JWT_ACCESS_SECRET');
}

export type JwtAccessPayload = {
  sub: string;
  role: string;
};

export function signAccess(payload: JwtAccessPayload): string {
  const signOptions = { expiresIn: config.JWT_ACCESS_EXPIRES } as SignOptions;
  return jwt.sign({ sub: payload.sub, role: payload.role }, getAccessSecret(), signOptions);
}

export function verifyAccess(token: string): JwtAccessPayload {
  const decoded = jwt.verify(token, getAccessSecret());
  if (typeof decoded !== 'object' || decoded === null) {
    throw new Error('Invalid token payload');
  }
  const sub = 'sub' in decoded && typeof decoded.sub === 'string' ? decoded.sub : null;
  const role = 'role' in decoded && typeof decoded.role === 'string' ? decoded.role : null;
  if (!sub || !role) {
    throw new Error('Invalid token payload');
  }
  return { sub, role };
}
