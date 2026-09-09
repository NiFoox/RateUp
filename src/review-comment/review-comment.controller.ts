import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../shared/middlewares/auth.js';
import type { ValidatedLocals } from '../shared/middlewares/validate.js';
import type { ReviewCommentService } from './review-comment.service.js';
import type {
  ReviewCommentBaseParamsDto,
  ReviewCommentWithIdParamsDto,
} from './dto/comment-params.dto.js';
import type { ReviewCommentCreateDto } from './dto/create-comment.dto.js';
import type { ReviewCommentUpdateDto } from './dto/update-comment.dto.js';
import type {
  ReviewCommentListQueryDto,
  ReviewCommentListDto,
  ReviewCommentDetailsListDto,
} from './dto/list-comments.dto.js';
import type { ReviewCommentDto } from './dto/review-comment.dto.js';

export class ReviewCommentController {
  constructor(private readonly service: ReviewCommentService) {}

  async create(
    req: AuthenticatedRequest,
    res: Response<
      ReviewCommentDto,
      ValidatedLocals<{ params: ReviewCommentBaseParamsDto; body: ReviewCommentCreateDto }>
    >,
  ): Promise<void> {
    const { params, body } = res.locals.validated;
    res.status(201).json(await this.service.create(params.reviewId, body, Number(req.user!.sub)));
  }

  async list(
    _req: Request,
    res: Response<
      ReviewCommentListDto,
      ValidatedLocals<{ params: ReviewCommentBaseParamsDto; query: ReviewCommentListQueryDto }>
    >,
  ): Promise<void> {
    const { params, query } = res.locals.validated;
    res.json(await this.service.list(params.reviewId, query));
  }

  async listWithUser(
    _req: Request,
    res: Response<
      ReviewCommentDetailsListDto,
      ValidatedLocals<{ params: ReviewCommentBaseParamsDto; query: ReviewCommentListQueryDto }>
    >,
  ): Promise<void> {
    const { params, query } = res.locals.validated;
    res.json(await this.service.listWithUser(params.reviewId, query));
  }

  async patch(
    req: AuthenticatedRequest,
    res: Response<
      ReviewCommentDto,
      ValidatedLocals<{ params: ReviewCommentWithIdParamsDto; body: ReviewCommentUpdateDto }>
    >,
  ): Promise<void> {
    const { params, body } = res.locals.validated;
    res.json(
      await this.service.patch(params.reviewId, params.commentId, body, {
        id: Number(req.user!.sub),
        roles: req.user!.roles,
      }),
    );
  }

  async delete(
    req: AuthenticatedRequest,
    res: Response<void, ValidatedLocals<{ params: ReviewCommentWithIdParamsDto }>>,
  ): Promise<void> {
    const { reviewId, commentId } = res.locals.validated.params;
    await this.service.delete(reviewId, commentId, {
      id: Number(req.user!.sub),
      roles: req.user!.roles,
    });
    res.status(204).send();
  }
}
