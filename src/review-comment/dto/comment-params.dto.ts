import { z } from 'zod';

export const ReviewCommentBaseParamsSchema = z.object({
  reviewId: z.coerce.number().int().min(1).max(2147483647),
});

// /api/reviews/:reviewId/comments/:commentId
export const ReviewCommentWithIdParamsSchema = ReviewCommentBaseParamsSchema.extend({
  commentId: z.coerce.number().int().min(1).max(2147483647),
});

export type ReviewCommentBaseParamsDto = z.infer<typeof ReviewCommentBaseParamsSchema>;
export type ReviewCommentWithIdParamsDto = z.infer<typeof ReviewCommentWithIdParamsSchema>;
