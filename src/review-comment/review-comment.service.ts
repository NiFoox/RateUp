import { DomainError } from '../shared/errors/domain-error.js';
import { ReviewComment } from './review-comment.entity.js';
import type { ReviewCommentRepository } from './review-comment.repository.interface.js';
import type { ReviewCommentCreateDto } from './dto/create-comment.dto.js';
import type { ReviewCommentUpdateDto } from './dto/update-comment.dto.js';
import type {
  ReviewCommentListQueryDto,
  ReviewCommentListDto,
  ReviewCommentDetailsListDto,
} from './dto/list-comments.dto.js';
import type { ReviewCommentDto } from './dto/review-comment.dto.js';

type CommentActor = { id: number; roles: string[] };

export class ReviewCommentService {
  constructor(private readonly repository: ReviewCommentRepository) {}

  create(
    reviewId: number,
    body: ReviewCommentCreateDto,
    userId: number,
  ): Promise<ReviewCommentDto> {
    return this.repository.create(new ReviewComment(reviewId, userId, body.content));
  }

  async list(reviewId: number, query: ReviewCommentListQueryDto): Promise<ReviewCommentListDto> {
    const { page, pageSize } = query;
    const data = await this.repository.getByReview(reviewId, (page - 1) * pageSize, pageSize);
    return { reviewId, page, pageSize, data };
  }

  async listWithUser(
    reviewId: number,
    query: ReviewCommentListQueryDto,
  ): Promise<ReviewCommentDetailsListDto> {
    const { page, pageSize } = query;
    const [data, total] = await Promise.all([
      this.repository.getByReviewWithUser(reviewId, (page - 1) * pageSize, pageSize),
      this.repository.countByReview(reviewId),
    ]);
    return { reviewId, page, pageSize, count: data.length, total, data };
  }

  async patch(
    reviewId: number,
    commentId: number,
    body: ReviewCommentUpdateDto,
    actor: CommentActor,
  ): Promise<ReviewCommentDto> {
    await this.requireOwnerOrAdmin(reviewId, commentId, actor, 'modify');
    const updated = await this.repository.update(commentId, body);
    if (!updated) throw this.notFound();
    return updated;
  }

  async delete(reviewId: number, commentId: number, actor: CommentActor): Promise<void> {
    await this.requireOwnerOrAdmin(reviewId, commentId, actor, 'delete');
    if (!(await this.repository.delete(commentId, reviewId))) throw this.notFound();
  }

  private async requireOwnerOrAdmin(
    reviewId: number,
    commentId: number,
    actor: CommentActor,
    action: 'modify' | 'delete',
  ): Promise<void> {
    const existing = await this.repository.findById(commentId);
    if (!existing || existing.reviewId !== reviewId) throw this.notFound();
    if (existing.userId !== actor.id && !actor.roles.includes('ADMIN')) {
      throw new DomainError('FORBIDDEN', `Not authorized to ${action} this comment`, 403);
    }
  }

  private notFound(): DomainError {
    return new DomainError('COMMENT_NOT_FOUND', 'Comment not found', 404);
  }
}
