import { Pool } from 'pg';
import { config } from './config.js';

export function createPgPool() {
  return new Pool({
    ...config.postgres,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}
