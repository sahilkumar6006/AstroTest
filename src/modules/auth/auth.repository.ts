import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { RefreshToken, User } from '@prisma/client';
import { prisma } from '../../config/prisma.js';

export async function findUserByPhone(phone: string): Promise<User | null> {
  return prisma.user.findFirst({
    where: { phone, deletedAt: null },
  });
}

export async function createUser(phone: string): Promise<User> {
  return prisma.user.create({
    data: { phone },
  });
}

export async function findUserById(id: string): Promise<User | null> {
  return prisma.user.findFirst({
    where: { id, deletedAt: null },
  });
}

export async function createRefreshTokenForUser(userId: string, expiresAt: Date): Promise<string> {
  const id = randomUUID();
  const secret = randomBytes(32).toString('base64url');
  const plainToken = `${id}.${secret}`;
  const tokenHash = await bcrypt.hash(plainToken, 10);
  await prisma.refreshToken.create({
    data: { id, tokenHash, userId, expiresAt },
  });
  return plainToken;
}

export type RefreshTokenWithUser = RefreshToken & { user: User };

export async function findValidRefreshToken(plainToken: string): Promise<RefreshTokenWithUser | null> {
  const dot = plainToken.indexOf('.');
  if (dot === -1) {
    return null;
  }
  const id = plainToken.slice(0, dot);
  const row = await prisma.refreshToken.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!row || row.user.deletedAt !== null) {
    return null;
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    return null;
  }
  const ok = await bcrypt.compare(plainToken, row.tokenHash);
  if (!ok) {
    return null;
  }
  return row;
}

export async function deleteRefreshTokenById(id: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { id } });
}
