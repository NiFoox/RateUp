import { ReviewComment } from './review-comment.entity.js';
import type { ReviewCommentWithUserDto } from './dto/review-comment-with-user.dto.js';

export interface ReviewCommentRepository {
  create(comment: ReviewComment): Promise<ReviewComment>;

  findById(id: number): Promise<ReviewComment | null>;

  getByReview(
    reviewId: number,
    offset: number,
    limit: number,
  ): Promise<ReviewComment[]>;

  getByReviewWithUser(
    reviewId: number,
    offset: number,
    limit: number,
  ): Promise<ReviewCommentWithUserDto[]>;

  countByReview(reviewId: number): Promise<number>;

  update(
    id: number,
    data: Partial<Pick<ReviewComment, 'content'>>,
  ): Promise<ReviewComment | undefined>;

  delete(id: number, reviewId?: number): Promise<boolean>;
}
