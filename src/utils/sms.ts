import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { config } from '../config/app.config.js';
import { AppError } from '../shared/errors/app-error.js';
import { logger } from '../shared/utils/logger.js';

const canUseTwilio = Boolean(config.TWILIO_ACCOUNT_SID) && Boolean(config.TWILIO_AUTH_TOKEN) && Boolean(config.TWILIO_PHONE);
const twilioClient = canUseTwilio
  ? twilio(config.TWILIO_ACCOUNT_SID!, config.TWILIO_AUTH_TOKEN!)
  : null;

const canUseSmtp = Boolean(config.SMTP_HOST) && Boolean(config.SMTP_PORT) && Boolean(config.SMTP_USER) && Boolean(config.SMTP_PASS);
const transporter = canUseSmtp
  ? nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: Number.parseInt(config.SMTP_PORT!, 10),
      auth: { user: config.SMTP_USER!, pass: config.SMTP_PASS! },
    })
  : null;

export async function sendSMS(to: string, otp: string): Promise<void> {
  if (!twilioClient) {
    if (config.NODE_ENV === 'production') {
      throw new AppError('SMS provider is not configured', 503, 'SMS_UNAVAILABLE');
    }
    logger.info('Twilio not configured; SMS skipped', { to });
    return;
  }
  await twilioClient.messages.create({
    body: `Your Astro OTP is ${otp}. Valid for 5 minutes.`,
    from: config.TWILIO_PHONE!,
    to,
  });
}

export async function sendEmail(to: string, otp: string): Promise<void> {
  if (!transporter) {
    logger.info('SMTP not configured; OTP fallback log', { to, otp });
    return;
  }
  await transporter.sendMail({
    from: `"Astro" <${config.SMTP_USER}>`,
    to,
    subject: 'Your OTP Code',
    html: `<p>Your OTP is <strong>${otp}</strong>. Valid for 5 minutes.</p>`,
  });
}
