import type { User } from '@prisma/client';
import { roleToJwt } from './role.js';

export type PublicUser = {
  id: string;
  phone: string;
  role: string;
  displayName: string | null;
  walletBalancePaise: number;
};

export function userToPublic(user: User): PublicUser {
  return {
    id: user.id,
    phone: user.phone,
    role: roleToJwt(user.role),
    displayName: user.displayName,
    walletBalancePaise: user.walletBalancePaise,
  };
}
