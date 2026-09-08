import type { z } from 'zod';
import { UserCredentialsSchema } from '../../user/dto/user-fields.js';

// Comparte las reglas de estos campos, pero excluye todo privilegio administrativo.
export const AuthRegisterSchema = UserCredentialsSchema;

export type AuthRegisterDto = z.output<typeof AuthRegisterSchema>;
