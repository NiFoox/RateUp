import type { z } from 'zod';
import { UserCreateSchema } from '../../user/validators/user.validation.js';

// Comparte las reglas de estos campos, pero excluye todo privilegio administrativo.
export const AuthRegisterSchema = UserCreateSchema.pick({
  username: true,
  email: true,
  password: true,
});

export type AuthRegisterDto = z.output<typeof AuthRegisterSchema>;
