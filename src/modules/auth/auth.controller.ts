import type { CookieOptions, Request, Response } from 'express';
import { config } from '../../config/app.config.js';
import { durationStringToMs } from '../../utils/duration.js';
import { sendSuccess } from '../../utils/response.js';
import * as authService from './auth.service.js';
import type { SendOtpBody, VerifyOtpBody } from './auth.schema.js';

export const REFRESH_TOKEN_COOKIE = 'refreshToken';

const REFRESH_COOKIE_BASE: Pick<CookieOptions, 'httpOnly' | 'sameSite' | 'path'> = {
  httpOnly: true,
  sameSite: 'strict',
  path: '/api/v1/auth',
};

function refreshCookieOptions(maxAge: number): CookieOptions {
  return {
    ...REFRESH_COOKIE_BASE,
    secure: config.NODE_ENV === 'production',
    maxAge,
  };
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    ...REFRESH_COOKIE_BASE,
    secure: config.NODE_ENV === 'production',
  });
}

export async function sendOtpHandler(req: Request, res: Response): Promise<void> {
  const { phone } = req.body as SendOtpBody;
  const { expiresIn } = await authService.sendOtp(phone);
  sendSuccess(res, {
    message: 'OTP sent successfully',
    data: { expiresIn },
  });
}

export async function verifyOtpHandler(req: Request, res: Response): Promise<void> {
  const { phone, otp } = req.body as VerifyOtpBody;
  const { accessToken, refreshToken, user } = await authService.verifyOtpAndIssueSession(phone, otp);
  const maxAge = durationStringToMs(config.JWT_REFRESH_EXPIRES);
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, refreshCookieOptions(maxAge));
  sendSuccess(res, {
    message: 'Signed in successfully',
    data: { accessToken, user },
  });
}

export async function refreshHandler(req: Request, res: Response): Promise<void> {
  const token = req.cookies[REFRESH_TOKEN_COOKIE] as string | undefined;
  const { accessToken, refreshToken } = await authService.refreshSession(token);
  const maxAge = durationStringToMs(config.JWT_REFRESH_EXPIRES);
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, refreshCookieOptions(maxAge));
  sendSuccess(res, {
    message: 'Token refreshed',
    data: { accessToken },
  });
}

export async function logoutHandler(req: Request, res: Response): Promise<void> {
  const token = req.cookies[REFRESH_TOKEN_COOKIE] as string | undefined;
  await authService.logout(token);
  clearRefreshCookie(res);
  sendSuccess(res, { message: 'Logged out' });
}
