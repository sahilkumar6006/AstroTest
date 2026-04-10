import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { redis } from '../config/redis.js';
import { config } from '../config/app.config.js';
import { AppError } from '../shared/errors/app-error.js';

function otpStorageKey(phone: string): string {
  return `otp:${phone}`;
}

function otpRateLimitKey(phone: string): string {
  return `otp:ratelimit:${phone}`;
}

export function generateOtp(): string {
  if (config.NODE_ENV === 'production') {
    const min = 10 ** (config.OTP_LENGTH - 1);
    const max = 10 ** config.OTP_LENGTH;
    return String(randomInt(min, max));
  }
  return config.OTP_MAGIC_CODE;
}

export async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, 10);
}

export async function verifyOtpAgainstHash(otp: string, hash: string): Promise<boolean> {
  return bcrypt.compare(otp, hash);
}

type FallbackEntry = { hash: string; expiresAt: number };
const fallbackOtpByPhone = new Map<string, FallbackEntry>();

function requiresRedisForOtp(): boolean {
  return config.NODE_ENV === 'production';
}

export async function assertOtpSendRateLimit(phone: string): Promise<void> {
  if (config.NODE_ENV !== 'production') {
    return;
  }
  if (!redis) {
    throw new AppError('Redis is required for OTP rate limiting', 503, 'SERVICE_UNAVAILABLE');
  }
  const key = otpRateLimitKey(phone);
  const sends = await redis.incr(key);
  if (sends === 1) {
    await redis.expire(key, config.OTP_RATE_LIMIT_WINDOW);
  }
  if (sends > config.OTP_RATE_LIMIT_MAX) {
    throw new AppError('Too many OTP requests. Try again later.', 429, 'OTP_RATE_LIMIT');
  }
}

export async function storeOtpForPhone(phone: string, otpPlain: string): Promise<void> {
  const hash = await hashOtp(otpPlain);
  const ttl = config.OTP_EXPIRY_SECONDS;
  if (redis) {
    await redis.set(otpStorageKey(phone), hash, 'EX', ttl);
    return;
  }
  if (requiresRedisForOtp()) {
    throw new AppError('Redis is required for OTP', 503, 'SERVICE_UNAVAILABLE');
  }
  fallbackOtpByPhone.set(phone, { hash, expiresAt: Date.now() + ttl * 1000 });
  setTimeout(() => fallbackOtpByPhone.delete(phone), ttl * 1000);
}

export async function readOtpHashForPhone(phone: string): Promise<string | null> {
  if (redis) {
    return redis.get(otpStorageKey(phone));
  }
  if (requiresRedisForOtp()) {
    throw new AppError('Redis is required for OTP', 503, 'SERVICE_UNAVAILABLE');
  }
  const entry = fallbackOtpByPhone.get(phone);
  if (!entry) {
    return null;
  }
  if (Date.now() > entry.expiresAt) {
    fallbackOtpByPhone.delete(phone);
    return null;
  }
  return entry.hash;
}

export async function deleteOtpForPhone(phone: string): Promise<void> {
  if (redis) {
    await redis.del(otpStorageKey(phone));
    return;
  }
  if (!requiresRedisForOtp()) {
    fallbackOtpByPhone.delete(phone);
  }
}
