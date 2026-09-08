import { Review } from './review.entity.js';
import { ReviewWithRelationsDto } from './dto/review-with-relations.dto.js';
import type { TrendingReviewDto } from './dto/trending-review.dto.js';

export interface ReviewRepository {
  create(review: Review): Promise<Review>;
  
  findById(id: number): Promise<Review | null>;

  getPaginated(
    offset: number,
    limit: number,
    opts?: { gameId?: number; userId?: number },
  ): Promise<{ data: Review[]; total: number }>;

  getPaginatedWithVotes(
    offset: number,
    limit: number,
    opts?: { gameId?: number; userId?: number ; search?: string },
  ): Promise<{
    data: Array<{
      review: Review;
      votes: { upvotes: number; downvotes: number; score: number };
    }>;
    total: number;
  }>;

  findByIdWithRelations(id: number): Promise<ReviewWithRelationsDto | null>;

  getTrendingReviews(
    limit: number,
    daysWindow: number,
  ): Promise<TrendingReviewDto[]>;

  update(id: number, data: Partial<Review>): Promise<Review | undefined>;

  delete(id: number): Promise<boolean>;
}
