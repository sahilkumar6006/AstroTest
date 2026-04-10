import { AppError } from '../shared/errors/app-error.js';

export function durationStringToMs(expiresIn: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(expiresIn.trim());
  if (!match) {
    throw new AppError('Invalid duration string', 500, 'CONFIG_ERROR');
  }
  const n = Number(match[1]);
  const unit = match[2];
  switch (unit) {
    case 'ms':
      return n;
    case 's':
      return n * 1000;
    case 'm':
      return n * 60_000;
    case 'h':
      return n * 3_600_000;
    case 'd':
      return n * 86_400_000;
    default:
      return n * 86_400_000;
  }
}

export function addExpiresInToDate(expiresIn: string): Date {
  return new Date(Date.now() + durationStringToMs(expiresIn));
}
