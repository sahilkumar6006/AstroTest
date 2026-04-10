import { Redis } from 'ioredis';
import { config } from './app.config.js';
import { logger } from '../shared/utils/logger.js';

const redisUrl = config.REDIS_URL;
export const redis = redisUrl ? new Redis(redisUrl) : null;

if (redis) {
  redis.on('error', (error) => {
    logger.error('Redis error', { message: error.message });
  });
}
