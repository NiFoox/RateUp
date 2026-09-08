import { z } from 'zod';
import { UserCredentialsSchema, UserRolesSchema } from './user-fields.js';

// Contrato de creación administrativa; Auth usa solo UserCredentialsSchema.
export const UserCreateSchema = UserCredentialsSchema.extend({
  roles: UserRolesSchema,
  isActive: z.boolean().default(true),
});

export type UserCreateDto = z.output<typeof UserCreateSchema>;
