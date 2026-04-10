import type { Role } from '@prisma/client';

export function roleToJwt(role: Role): string {
  switch (role) {
    case 'USER':
      return 'user';
    case 'ASTROLOGER':
      return 'astrologer';
    case 'ADMIN':
      return 'admin';
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}

export function jwtToRole(role: string): Role {
  switch (role) {
    case 'user':
      return 'USER';
    case 'astrologer':
      return 'ASTROLOGER';
    case 'admin':
      return 'ADMIN';
    default:
      return 'USER';
  }
}
