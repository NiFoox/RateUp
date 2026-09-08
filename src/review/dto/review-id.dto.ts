import { z } from 'zod';

export const ReviewResourceIdSchema = z.coerce.number().int().positive().max(2_147_483_647);
export const ReviewIdParamSchema = z.object({ id: ReviewResourceIdSchema });
export type ReviewIdParamDto = z.output<typeof ReviewIdParamSchema>;
