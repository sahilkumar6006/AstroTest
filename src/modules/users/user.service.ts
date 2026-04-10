import { NotFoundError } from '../../shared/errors/app-error.js';
import type { PublicUser } from '../../utils/public-user.js';
import { userToPublic } from '../../utils/public-user.js';
import * as userRepository from './user.repository.js';

export async function getMe(userId: string): Promise<PublicUser> {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new NotFoundError('User');
  }
  return userToPublic(user);
}

export async function updateMe(
  userId: string,
  data: { displayName?: string | null },
): Promise<PublicUser> {
  const existing = await userRepository.findById(userId);
  if (!existing) {
    throw new NotFoundError('User');
  }
  const user = await userRepository.updateProfile(userId, data);
  return userToPublic(user);
}
