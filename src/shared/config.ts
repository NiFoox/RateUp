import 'dotenv/config';
import { z } from 'zod';

const port = z.string().regex(/^\d+$/).pipe(z.coerce.number<string>().int().min(1).max(65535));
const nonEmpty = z.string().min(1);
const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
  JWT_SECRET: nonEmpty.refine((value) => value.trim().length > 0, 'Must not be blank'),
  PORT: port.default(3000),
  POSTGRES_HOST: nonEmpty.default('localhost'),
  POSTGRES_PORT: port.default(5432),
  POSTGRES_USER: nonEmpty.default('rateup'),
  POSTGRES_PASSWORD: nonEmpty.default('rateup123'),
  POSTGRES_DB: nonEmpty.default('rateupdb'),
});

const parsed = environmentSchema.safeParse(process.env);
if (!parsed.success) {
  // Identificar variables inválidas sin imprimir valores ni secretos.
  throw new Error(
    `Invalid environment variables: ${parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')}`,
  );
}
const env = parsed.data;

export const config = {
  nodeEnv: env.NODE_ENV,
  logLevel: env.LOG_LEVEL ?? (env.NODE_ENV === 'production' ? 'info' : 'debug'),
  jwtSecret: env.JWT_SECRET,
  port: env.PORT,
  postgres: {
    host: env.POSTGRES_HOST,
    port: env.POSTGRES_PORT,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    database: env.POSTGRES_DB,
  },
};
