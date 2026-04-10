export type NodeEnv = 'development' | 'test' | 'production';

const DEFAULT_PORT = 3000;

function parsePort(value: string | undefined): number {
  if (!value) {
    return DEFAULT_PORT;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error('PORT must be a valid number between 1 and 65535');
  }
  return parsed;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

function parseNodeEnv(value: string | undefined): NodeEnv {
  if (value === 'development' || value === 'test' || value === 'production') {
    return value;
  }
  return 'development';
}

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export const config = {
  NODE_ENV: parseNodeEnv(process.env.NODE_ENV),
  PORT: parsePort(process.env.PORT),
  API_BASE_URL: process.env.API_BASE_URL ?? 'http://localhost:3000',
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRES: process.env.JWT_ACCESS_EXPIRES_IN ?? process.env.JWT_ACCESS_EXPIRES ?? '15m',
  JWT_REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES_IN ?? process.env.JWT_REFRESH_EXPIRES ?? '7d',
  OTP_MAGIC_CODE: process.env.OTP_MAGIC_CODE ?? '123456',
  OTP_EXPIRY_SECONDS: parsePositiveInt(process.env.OTP_EXPIRY_SECONDS, 300),
  OTP_LENGTH: parsePositiveInt(process.env.OTP_LENGTH, 6),
  OTP_RATE_LIMIT_MAX: parsePositiveInt(process.env.OTP_RATE_LIMIT_MAX, 3),
  OTP_RATE_LIMIT_WINDOW: parsePositiveInt(process.env.OTP_RATE_LIMIT_WINDOW, 600),
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_PHONE: process.env.TWILIO_PHONE,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  CLIENT_URL: process.env.CLIENT_URL ?? 'http://localhost:5173',
  require: getEnv,
} as const;
