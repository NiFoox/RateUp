import { z } from 'zod';

// /api/reviews/:reviewId/votes
export const ReviewVoteParamsSchema = z.object({
  reviewId: z.coerce.number().int().min(1).max(2147483647),
});

// Body para POST (upsert vote)
export const ReviewVoteBodySchema = z
  .object({
    value: z.union([z.literal(1), z.literal(-1)]),
  })
  .strict();

export type ReviewVoteParamsDto = z.infer<typeof ReviewVoteParamsSchema>;
export type ReviewVoteBodyDto = z.infer<typeof ReviewVoteBodySchema>;

export interface ReviewVoteSummaryDto {
  upvotes: number;
  downvotes: number;
  score: number;
}
export interface ReviewVoteSummaryResponseDto extends ReviewVoteSummaryDto {
  reviewId: number;
  userVote: -1 | 0 | 1;
}
export interface ReviewVoteUpsertResponseDto extends ReviewVoteSummaryDto {
  reviewId: number;
  userId: number;
  value: 1 | -1;
}
export interface ReviewVoteDeleteResponseDto extends ReviewVoteSummaryDto {
  reviewId: number;
  deleted: boolean;
}
