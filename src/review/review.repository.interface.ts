import type { Review } from './review.entity.js';
import type { ReviewWithRelationsDto } from './dto/review-with-relations.dto.js';
import type { TrendingReviewDto } from './dto/trending-review.dto.js';
import type { ReviewDto, ReviewListItemDto } from './dto/review.dto.js';
import type { ReviewUpdateDto } from './dto/update-review.dto.js';

export interface ReviewFilters {
  gameId?: number;
  userId?: number;
  search?: string;
}

export interface ReviewRepository {
  create(review: Review): Promise<ReviewDto>;
  findById(id: number): Promise<ReviewDto | null>;
  getListPage(
    offset: number,
    limit: number,
    filters: ReviewFilters,
    currentUserId: number | null,
  ): Promise<{ data: ReviewListItemDto[]; total: number }>;
  findByIdWithRelations(id: number): Promise<ReviewWithRelationsDto | null>;
  getTrendingReviews(limit: number, daysWindow: number): Promise<TrendingReviewDto[]>;
  update(id: number, data: ReviewUpdateDto): Promise<ReviewDto | undefined>;
  delete(id: number): Promise<boolean>;
}
