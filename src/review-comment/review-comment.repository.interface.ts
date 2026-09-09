import { ReviewComment } from './review-comment.entity.js';
import type { ReviewCommentDto } from './dto/review-comment.dto.js';
import type { ReviewCommentUpdateDto } from './dto/update-comment.dto.js';
import type { ReviewCommentWithUserDto } from './dto/review-comment-with-user.dto.js';

export interface ReviewCommentRepository {
  create(comment: ReviewComment): Promise<ReviewCommentDto>;

  findById(id: number): Promise<ReviewCommentDto | null>;

  getByReview(reviewId: number, offset: number, limit: number): Promise<ReviewCommentDto[]>;

  getByReviewWithUser(
    reviewId: number,
    offset: number,
    limit: number,
  ): Promise<ReviewCommentWithUserDto[]>;

  countByReview(reviewId: number): Promise<number>;

  update(id: number, data: ReviewCommentUpdateDto): Promise<ReviewCommentDto | undefined>;

  delete(id: number, reviewId: number): Promise<boolean>;
}
