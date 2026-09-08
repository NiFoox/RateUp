import { DomainError } from '../shared/errors/domain-error.js';
import type { UserRole } from '../user/user.entity.js';
import type { ReviewRepository } from './review.repository.interface.js';
import type { ReviewCommentRepository } from '../review-comment/review-comment.repository.interface.js';
import type { ReviewVoteRepository } from '../review-vote/review-vote.repository.interface.js';
import { Review } from './review.entity.js';
import type { ReviewCreateDto } from './dto/create-review.dto.js';
import type { ReviewUpdateDto } from './dto/update-review.dto.js';
import type { ReviewListQueryDto } from './dto/list-reviews.dto.js';
import type { ReviewFullQueryDto, ReviewFullDto } from './dto/full-review.dto.js';
import type { ReviewDto, ReviewListDto } from './dto/review.dto.js';
import type { ReviewWithRelationsDto } from './dto/review-with-relations.dto.js';

type ReviewActor = { id: number; roles: UserRole[] };

export class ReviewService {
  constructor(
    private readonly repository: ReviewRepository,
    private readonly commentRepository: ReviewCommentRepository,
    private readonly voteRepository: ReviewVoteRepository,
  ) {}

  async create(dto: ReviewCreateDto, userId: number): Promise<ReviewDto> {
    return this.repository.create(new Review(dto.gameId, userId, dto.content, dto.score));
  }

  async getById(id: number): Promise<ReviewDto> {
    const review = await this.repository.findById(id);
    if (!review) throw new DomainError('REVIEW_NOT_FOUND', 'Reseña no encontrada', 404);
    return review;
  }

  async list(query: ReviewListQueryDto, currentUserId: number | null): Promise<ReviewListDto> {
    const { page, pageSize, ...filters } = query;
    const result = await this.repository.getListPage(
      (page - 1) * pageSize,
      pageSize,
      filters,
      currentUserId,
    );
    return { page, pageSize, ...result };
  }

  async listMine(query: ReviewListQueryDto, userId: number): Promise<ReviewListDto> {
    return this.list({ ...query, userId }, userId);
  }

  async getWithRelations(id: number): Promise<ReviewWithRelationsDto> {
    const review = await this.repository.findByIdWithRelations(id);
    if (!review) throw new DomainError('REVIEW_NOT_FOUND', 'Reseña no encontrada', 404);
    return review;
  }

  async getFull(
    id: number,
    query: ReviewFullQueryDto,
    currentUserId: number | null,
  ): Promise<ReviewFullDto> {
    const review = await this.getWithRelations(id);
    const { commentsPage: page, commentsPageSize: pageSize } = query;
    const [total, data, summary, userVote] = await Promise.all([
      this.commentRepository.countByReview(id),
      this.commentRepository.getByReviewWithUser(id, (page - 1) * pageSize, pageSize),
      this.voteRepository.getSummary(id),
      currentUserId === null
        ? Promise.resolve(0 as const)
        : this.voteRepository.getUserVote(id, currentUserId),
    ]);
    return {
      reviewId: id,
      review,
      comments: { page, pageSize, total, data },
      votes: { reviewId: id, ...summary },
      userVote,
    };
  }

  private async requireOwnerOrAdmin(id: number, actor: ReviewActor): Promise<void> {
    const review = await this.getById(id);
    if (review.userId !== actor.id && !actor.roles.includes('ADMIN')) {
      throw new DomainError(
        'FORBIDDEN',
        'No autorizado para modificar o eliminar esta reseña',
        403,
      );
    }
  }

  async patch(id: number, dto: ReviewUpdateDto, actor: ReviewActor): Promise<ReviewDto> {
    await this.requireOwnerOrAdmin(id, actor);
    const review = await this.repository.update(id, dto);
    if (!review) throw new DomainError('REVIEW_NOT_FOUND', 'Reseña no encontrada', 404);
    return review;
  }

  async delete(id: number, actor: ReviewActor): Promise<void> {
    await this.requireOwnerOrAdmin(id, actor);
    if (!(await this.repository.delete(id))) {
      throw new DomainError('REVIEW_NOT_FOUND', 'Reseña no encontrada', 404);
    }
  }
}
