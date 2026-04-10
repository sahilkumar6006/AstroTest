import { config } from '../../config/app.config.js';
import { AppError } from '../../shared/errors/app-error.js';
import { logger } from '../../shared/utils/logger.js';
import { addExpiresInToDate } from '../../utils/duration.js';
import { signAccess } from '../../utils/jwt.js';
import {
  assertOtpSendRateLimit,
  deleteOtpForPhone,
  generateOtp,
  readOtpHashForPhone,
  storeOtpForPhone,
  verifyOtpAgainstHash,
} from '../../utils/otp.js';
import type { PublicUser } from '../../utils/public-user.js';
import { userToPublic } from '../../utils/public-user.js';
import { roleToJwt } from '../../utils/role.js';
import { sendSMS } from '../../utils/sms.js';
import * as authRepository from './auth.repository.js';

export type { PublicUser } from '../../utils/public-user.js';

export async function sendOtp(phone: string): Promise<{ expiresIn: number }> {
  await assertOtpSendRateLimit(phone);
  const otp = generateOtp();
  await storeOtpForPhone(phone, otp);

  if (config.NODE_ENV === 'production') {
    await sendSMS(phone, otp);
  }

  if (config.NODE_ENV === 'development') {
    logger.info(`[DEV OTP] Phone: ${phone} → OTP: ${otp}`);
  }

  return { expiresIn: config.OTP_EXPIRY_SECONDS };
}

export async function verifyOtpAndIssueSession(
  phone: string,
  otp: string,
): Promise<{ accessToken: string; refreshToken: string; user: PublicUser }> {
  const storedHash = await readOtpHashForPhone(phone);
  if (!storedHash) {
    throw new AppError('OTP expired or not found', 401, 'OTP_EXPIRED');
  }
  const valid = await verifyOtpAgainstHash(otp, storedHash);
  if (!valid) {
    throw new AppError('Invalid OTP', 401, 'OTP_INVALID');
  }
  await deleteOtpForPhone(phone);

  let user = await authRepository.findUserByPhone(phone);
  if (!user) {
    user = await authRepository.createUser(phone);
  }
  const expiresAt = addExpiresInToDate(config.JWT_REFRESH_EXPIRES);
  const refreshToken = await authRepository.createRefreshTokenForUser(user.id, expiresAt);
  const accessToken = signAccess({ sub: user.id, role: roleToJwt(user.role) });
  return {
    accessToken,
    refreshToken,
    user: userToPublic(user),
  };
}

export async function refreshSession(
  refreshTokenPlain: string | undefined,
): Promise<{ accessToken: string; refreshToken: string }> {
  if (!refreshTokenPlain) {
    throw new AppError('Missing refresh token', 401, 'REFRESH_TOKEN_MISSING');
  }
  const row = await authRepository.findValidRefreshToken(refreshTokenPlain);
  if (!row) {
    throw new AppError('Invalid refresh token', 401, 'REFRESH_TOKEN_INVALID');
  }
  await authRepository.deleteRefreshTokenById(row.id);
  const expiresAt = addExpiresInToDate(config.JWT_REFRESH_EXPIRES);
  const refreshToken = await authRepository.createRefreshTokenForUser(row.userId, expiresAt);
  const accessToken = signAccess({ sub: row.user.id, role: roleToJwt(row.user.role) });
  return { accessToken, refreshToken };
}

export async function logout(refreshTokenPlain: string | undefined): Promise<void> {
  if (!refreshTokenPlain) {
    return;
  }
  const row = await authRepository.findValidRefreshToken(refreshTokenPlain);
  if (row) {
    await authRepository.deleteRefreshTokenById(row.id);
  }
}
