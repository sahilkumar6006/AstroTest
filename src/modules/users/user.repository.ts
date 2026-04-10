import type { User } from '@prisma/client';
import { prisma } from '../../config/prisma.js';

export async function findById(id: string): Promise<User | null> {
  return prisma.user.findFirst({
    where: { id, deletedAt: null },
  });
}

export async function updateProfile(
  id: string,
  data: { displayName?: string | null },
): Promise<User> {
  return prisma.user.update({
    where: { id },
    data,
  });
}
