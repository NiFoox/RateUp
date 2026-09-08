import { z } from 'zod';

export const UserIdParamSchema = z.strictObject({
  id: z.coerce.number().int().positive().max(2_147_483_647),
});

export type UserIdParamDto = z.output<typeof UserIdParamSchema>;
