import { z } from 'zod';
import { config } from '../../config/app.config.js';

const e164Phone = z
  .string()
  .regex(/^\+[1-9]\d{1,14}$/, 'Must be a valid E.164 phone number');

const otpPattern = new RegExp(`^\\d{${config.OTP_LENGTH}}$`);

export const sendOtpBodySchema = z.object({
  phone: e164Phone,
});

export const verifyOtpBodySchema = z.object({
  phone: e164Phone,
  otp: z
    .string()
    .regex(otpPattern, `OTP must be ${config.OTP_LENGTH} digits`),
});

export type SendOtpBody = z.infer<typeof sendOtpBodySchema>;
export type VerifyOtpBody = z.infer<typeof verifyOtpBodySchema>;
