import http from 'http';
import app from './app.js';
import { logger } from './shared/logger.js';
import { config } from './shared/config.js';
import { container } from './shared/container.js';

const server = http.createServer(app);
server.keepAliveTimeout = 60_000;
server.headersTimeout = 65_000;
server.requestTimeout = 60_000;

let shuttingDown = false;

// Una petición activa al recibir la señal puede pasar a keep-alive después.
server.on('request', (_req, res) => {
  res.on('finish', () => {
    if (shuttingDown) setImmediate(() => server.closeIdleConnections());
  });
});

async function shutdown(exitCode: number): Promise<void> {
  process.exitCode = Math.max(Number(process.exitCode) || 0, exitCode);
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('Closing HTTP server and PostgreSQL pool');

  // Una petición bloqueada no puede impedir el cierre indefinidamente.
  const deadline = setTimeout(() => {
    logger.fatal('Shutdown timeout');
    server.closeAllConnections();
    process.exit(1);
  }, 10_000);
  deadline.unref();

  try {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error && (!('code' in error) || error.code !== 'ERR_SERVER_NOT_RUNNING')) reject(error);
        else resolve();
      });
    });
  } catch (err) {
    logger.error({ err }, 'HTTP shutdown failed');
    process.exitCode = 1;
  }

  try {
    await container.pool.end();
  } catch (err) {
    logger.error({ err }, 'PostgreSQL shutdown failed');
    process.exitCode = 1;
  }
  clearTimeout(deadline);
  logger.info('Shutdown complete');
  // Con los recursos cerrados, Node termina naturalmente con exitCode.
}

process.on('SIGINT', () => {
  void shutdown(0);
});
process.on('SIGTERM', () => {
  void shutdown(0);
});
process.on('unhandledRejection', (reason: unknown) => {
  logger.error({ reason }, 'UNHANDLED REJECTION');
  void shutdown(1);
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'UNCAUGHT EXCEPTION');
  void shutdown(1);
});
server.on('error', (err) => {
  logger.error({ err }, 'HTTP server failed');
  void shutdown(1);
});
container.pool.on('error', (err) => {
  logger.error({ err }, 'PostgreSQL idle client failed');
  void shutdown(1);
});

server.listen(config.port, () => {
  const url = `http://localhost:${config.port}`;
  logger.info({ port: config.port, url }, `Server is running on ${url}`);
});
