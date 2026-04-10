import 'dotenv/config';
import { app } from './app.js';
import { config } from './config/app.config.js';
import { connectDb, disconnectDb } from './config/db.js';
import { logger } from './shared/utils/logger.js';

const server = app.listen(config.PORT, async () => {
  try {
    await connectDb();
    logger.info('PostgreSQL connected');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown database connection error';
    logger.error('Database connection failed', { message });
  }
  logger.info('Server started', { port: config.PORT, env: config.NODE_ENV });
});

const shutdown = async (signal: string) => {
  logger.info('Shutting down gracefully', { signal });
  await disconnectDb();
  server.close(() => process.exit(0));
};

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection, shutting down', { reason });
  process.exit(1);
});
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception, shutting down', { message: error.message, stack: error.stack });
  process.exit(1);
});
