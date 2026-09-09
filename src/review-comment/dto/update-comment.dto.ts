import { z } from 'zod';
import { ReviewCommentCreateSchema } from './create-comment.dto.js';

export const ReviewCommentUpdateSchema = ReviewCommentCreateSchema.partial();
export type ReviewCommentUpdateDto = z.infer<typeof ReviewCommentUpdateSchema>;
