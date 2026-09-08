import { z } from 'zod';

export const AuthLoginSchema = z.strictObject({
  usernameOrEmail: z.string().trim().min(1, 'usernameOrEmail is required'),
  password: z.string().min(1, 'password is required'),
  rememberMe: z.boolean().optional().default(false),
});

export type AuthLoginDto = z.output<typeof AuthLoginSchema>;
