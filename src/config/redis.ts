// Redis temporarily disabled — OTP uses in-memory fallback in non-production.
// When ready: uncomment below and set REDIS_URL in .env
//
// import { Redis } from 'ioredis';
// import { config } from './app.config.js';
// import { logger } from '../shared/utils/logger.js';
//
// const redisUrl = config.REDIS_URL;
// export const redis = redisUrl ? new Redis(redisUrl) : null;
//
// if (redis) {
//   redis.on('error', (error) => {
//     logger.error('Redis error', { message: error.message });
//   });
// }

import type { Redis } from 'ioredis';

export const redis: Redis | null = null;
