import { z } from 'zod';
import { UserRolesSchema } from './user-fields.js';

export const UserRolesUpdateSchema = z.strictObject({ roles: UserRolesSchema });

export type UserRolesUpdateDto = z.output<typeof UserRolesUpdateSchema>;
