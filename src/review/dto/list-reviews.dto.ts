import { z } from 'zod';
import { ReviewResourceIdSchema } from './review-id.dto.js';

const emptyToUndef = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export const ReviewListQuerySchema = z.object({
  page: z.preprocess(emptyToUndef, z.coerce.number().int().min(1).default(1)),
  pageSize: z.preprocess(emptyToUndef, z.coerce.number().int().min(1).max(100).default(10)),
  gameId: z.preprocess(emptyToUndef, ReviewResourceIdSchema.optional()),
  userId: z.preprocess(emptyToUndef, ReviewResourceIdSchema.optional()),
  search: z.preprocess(emptyToUndef, z.string().trim().min(1).optional()),
});

export type ReviewListQueryDto = z.output<typeof ReviewListQuerySchema>;
