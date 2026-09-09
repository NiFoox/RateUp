import pino from 'pino';
import { config } from './config.js';

const isDev = config.nodeEnv !== 'production';
const isTTY = process.stdout.isTTY === true;

export const logger = pino({
  level: config.logLevel,
  base: undefined, // { app: 'rateup-api' } sino
  transport:
    isDev && isTTY
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
      : undefined,
});
