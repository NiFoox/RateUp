import type { ReviewVoteRepository } from './review-vote.repository.interface.js';
import type {
  ReviewVoteSummaryResponseDto,
  ReviewVoteUpsertResponseDto,
  ReviewVoteDeleteResponseDto,
} from './dto/review-vote.dto.js';

export class ReviewVoteService {
  constructor(private readonly repository: ReviewVoteRepository) {}

  async getSummary(reviewId: number, userId: number | null): Promise<ReviewVoteSummaryResponseDto> {
    const [summary, userVote] = await Promise.all([
      this.repository.getSummary(reviewId),
      userId === null ? (0 as const) : this.repository.getUserVote(reviewId, userId),
    ]);
    return { reviewId, ...summary, userVote };
  }

  async upsert(
    reviewId: number,
    userId: number,
    value: 1 | -1,
  ): Promise<ReviewVoteUpsertResponseDto> {
    const vote = await this.repository.upsertVote(reviewId, userId, value);
    const summary = await this.repository.getSummary(reviewId);
    return { reviewId, userId, value: vote.value, ...summary };
  }

  async remove(reviewId: number, userId: number): Promise<ReviewVoteDeleteResponseDto> {
    const deleted = await this.repository.deleteVote(reviewId, userId);
    const summary = await this.repository.getSummary(reviewId);
    return { reviewId, deleted, ...summary };
  }
}
