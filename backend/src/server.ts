import http from 'http';
import app from './app';
import { env, validateEnv } from './config/env.config';
import { closePool } from './db/pool';
import { logger } from './utils/logger';

// 1. VALIDATE ENVIRONMENT AT STARTUP
try {
  validateEnv();
} catch (err: any) {
  logger.error('Startup halted due to missing configuration:', err.message);
  process.exit(1);
}

// 2. CREATE HTTP SERVER
const server = http.createServer(app);

const PORT = env.PORT;

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    logger.info(`==================================================`);
    logger.info(` Cognify Production Backend Engine`);
    logger.info(` Server Listening on Port: ${PORT}`);
    logger.info(` Environment: ${env.NODE_ENV}`);
    logger.info(` Neon Connection Pool: Active (Max 20 Connections)`);
    logger.info(` Neon Object Storage: Configured (${env.NEON_STORAGE_REGION})`);
    logger.info(`==================================================`);
  });
}

// 3. GRACEFUL SHUTDOWN HANDLING
let isShuttingDown = false;

export async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal}. Initiating graceful shutdown...`);

  server.close(async (err) => {
    if (err) {
      logger.error('Error closing HTTP server:', err);
    } else {
      logger.info('HTTP server stopped accepting connections.');
    }

    try {
      await closePool();
      logger.info('Graceful shutdown completed successfully.');
      if (process.env.NODE_ENV !== 'test') {
        process.exit(0);
      }
    } catch (dbErr) {
      logger.error('Error closing database pool during shutdown:', dbErr);
      if (process.env.NODE_ENV !== 'test') {
        process.exit(1);
      }
    }
  });

  setTimeout(() => {
    logger.error('Forced shutdown due to timeout.');
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  }, 10000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { server };
