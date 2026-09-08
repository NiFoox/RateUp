import { z } from 'zod';
import { UserCredentialsSchema, emptyToUndef } from './user-fields.js';

// Campos editables por el dueño del perfil.
export const UserUpdateSchema = UserCredentialsSchema.partial().extend({
  avatarUrl: z.preprocess(
    emptyToUndef,
    z.string().trim().url('avatarUrl must be a valid URL').nullable().optional(),
  ),
  bio: z.preprocess(
    emptyToUndef,
    z.string().trim().max(300, 'bio must be at most 300 characters').nullable().optional(),
  ),
});

// El endpoint compartido valida este contrato; el servicio autoriza isActive.
export const UserAdminUpdateSchema = UserUpdateSchema.extend({
  isActive: z.boolean().optional(),
});

export type UserUpdateDto = z.output<typeof UserUpdateSchema>;
export type UserAdminUpdateDto = z.output<typeof UserAdminUpdateSchema>;
