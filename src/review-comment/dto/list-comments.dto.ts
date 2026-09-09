import { z } from 'zod';
import type { ReviewCommentDto } from './review-comment.dto.js';
import type { ReviewCommentWithUserDto } from './review-comment-with-user.dto.js';

// helper: "" -> undefined
const emptyToUndef = (rawValue: unknown) =>
  typeof rawValue === 'string' && rawValue.trim() === '' ? undefined : rawValue;

export const ReviewCommentListQuerySchema = z.object({
  page: z.preprocess(emptyToUndef, z.coerce.number().int().min(1).default(1)),
  pageSize: z.preprocess(emptyToUndef, z.coerce.number().int().min(1).max(100).default(10)),
});

export type ReviewCommentListQueryDto = z.infer<typeof ReviewCommentListQuerySchema>;
export interface ReviewCommentListDto {
  reviewId: number;
  page: number;
  pageSize: number;
  data: ReviewCommentDto[];
}
export interface ReviewCommentDetailsListDto extends Omit<ReviewCommentListDto, 'data'> {
  count: number;
  total: number;
  data: ReviewCommentWithUserDto[];
}
