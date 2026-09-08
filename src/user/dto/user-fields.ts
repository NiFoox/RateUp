import { z } from 'zod';

// Límites de users.username VARCHAR(100) y users.email VARCHAR(255).
export const UserCredentialsSchema = z.strictObject({
  username: z.string().trim().min(1, 'username is required').max(100),
  email: z.string().trim().max(255).pipe(z.email({ message: 'invalid email' })),
  password: z.string().min(8, 'password must be at least 8 characters'),
});

export const UserRolesSchema = z.array(z.enum(['USER', 'ADMIN']))
  .min(1, 'roles must have at least one role');

export const emptyToUndef = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;
