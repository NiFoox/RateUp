import type { ReviewVoteSummaryDto } from './dto/review-vote.dto.js';
import { ReviewVote } from './review-vote.entity.js';

export interface ReviewVoteRepository {
  upsertVote(reviewId: number, userId: number, value: 1 | -1): Promise<ReviewVote>;
  deleteVote(reviewId: number, userId: number): Promise<boolean>;
  getSummary(reviewId: number): Promise<ReviewVoteSummaryDto>;
  getUserVote(reviewId: number, userId: number): Promise<-1 | 0 | 1>;
}
