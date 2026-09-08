import type { z } from 'zod';
import { ReviewCreateSchema } from './create-review.dto.js';

export const ReviewUpdateSchema = ReviewCreateSchema.partial();
export type ReviewUpdateDto = z.output<typeof ReviewUpdateSchema>;
