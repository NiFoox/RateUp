import { z } from 'zod';

export const GameIdParamSchema = z.object({
  id: z.coerce.number().int().positive().max(2_147_483_647),
});

export type GameIdParamDto = z.output<typeof GameIdParamSchema>;
