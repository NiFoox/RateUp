import { z } from 'zod';
import type { ReviewWithRelationsDto } from './review-with-relations.dto.js';
import type { ReviewVotesDto, ReviewVoteValue } from './review.dto.js';
import type { ReviewCommentWithUserDto } from '../../review-comment/dto/review-comment-with-user.dto.js';

// Solo la ausencia usa defaults; arrays, texto inválido y fracciones se rechazan.
const positiveIntegerQuery = z.string().trim().min(1).pipe(z.coerce.number<string>().int().min(1));
export const ReviewFullQuerySchema = z.object({
  commentsPage: positiveIntegerQuery.default(1),
  commentsPageSize: positiveIntegerQuery.pipe(z.number().max(100)).default(10),
});
export type ReviewFullQueryDto = z.output<typeof ReviewFullQuerySchema>;

export interface ReviewFullDto {
  reviewId: number;
  review: ReviewWithRelationsDto;
  comments: { page: number; pageSize: number; total: number; data: ReviewCommentWithUserDto[] };
  votes: ReviewVotesDto;
  userVote: ReviewVoteValue;
}
