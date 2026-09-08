import { z } from 'zod';
import { ReviewResourceIdSchema } from './review-id.dto.js';

export const ReviewCreateSchema = z.strictObject({
  gameId: ReviewResourceIdSchema,
  content: z.string().trim().min(1),
  score: z.coerce.number().int().min(1).max(5),
});
export type ReviewCreateDto = z.output<typeof ReviewCreateSchema>;
