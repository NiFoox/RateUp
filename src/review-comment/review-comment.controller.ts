import { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../shared/middlewares/auth.js';
import type { ReviewCommentRepository } from './review-comment.repository.interface.js';
import { ReviewComment } from './review-comment.entity.js';
import {
  ReviewCommentBaseParamsSchema,
  ReviewCommentWithIdParamsSchema,
  ReviewCommentCreateSchema,
  ReviewCommentUpdateSchema,
  ReviewCommentListQuerySchema,
  type ReviewCommentBaseParamsDto,
  type ReviewCommentWithIdParamsDto,
  type ReviewCommentCreateDto,
  type ReviewCommentUpdateDto,
  type ReviewCommentListQueryDto,
} from './validators/review-comment.validation.js';

export class ReviewCommentController {
  constructor(private readonly repository: ReviewCommentRepository) {}

  // POST /api/reviews/:reviewId/comments
  async create(req: Request, res: Response): Promise<void> {
    try {
      const params: ReviewCommentBaseParamsDto =
        (res.locals?.validated?.params as ReviewCommentBaseParamsDto) ??
        ReviewCommentBaseParamsSchema.parse(req.params);

      const body: ReviewCommentCreateDto =
        (res.locals?.validated?.body as ReviewCommentCreateDto) ??
        ReviewCommentCreateSchema.parse(req.body);

      const { reviewId } = params;
      const { content } = body;

      const authReq = req as AuthenticatedRequest;
      const authUser = authReq.user;

      if (!authUser) {
        res.status(401).json({ message: 'Not authenticated' });
        return;
      }

      const userId = Number(authUser.sub);

      const comment = new ReviewComment(reviewId, userId, content);
      const created = await this.repository.create(comment);

      res.status(201).json(created);
    } catch (error) {
      if (error instanceof Error && (error as any).name === 'ZodError') {
        res
          .status(400)
          .json({ message: 'Invalid data', details: (error as any).errors });
        return;
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // GET /api/reviews/:reviewId/comments
  async list(req: Request, res: Response): Promise<void> {
    const params: ReviewCommentBaseParamsDto =
      (res.locals?.validated?.params as ReviewCommentBaseParamsDto) ??
      ReviewCommentBaseParamsSchema.parse(req.params);

    const query: ReviewCommentListQueryDto =
      (res.locals?.validated?.query as ReviewCommentListQueryDto) ??
      ReviewCommentListQuerySchema.parse(req.query);

    const { reviewId } = params;
    const { page, pageSize } = query;

    const offset = (page - 1) * pageSize;

    const comments = await this.repository.getByReview(
      reviewId,
      offset,
      pageSize,
    );

    res.json({ reviewId, page, pageSize, data: comments });
  }

  // GET /api/reviews/:reviewId/comments/details
  async listWithUser(req: Request, res: Response): Promise<void> {
    try {
      const params: ReviewCommentBaseParamsDto =
        (res.locals?.validated?.params as ReviewCommentBaseParamsDto) ??
        ReviewCommentBaseParamsSchema.parse(req.params);

      const query: ReviewCommentListQueryDto =
        (res.locals?.validated?.query as ReviewCommentListQueryDto) ??
        ReviewCommentListQuerySchema.parse(req.query);

      const { reviewId } = params;
      const { page, pageSize } = query;

      const offset = (page - 1) * pageSize;

      const comments = await this.repository.getByReviewWithUser(
        reviewId,
        offset,
        pageSize,
      );

      res.json({
        reviewId,
        page,
        pageSize,
        count: comments.length,
        data: comments,
      });
    } catch (error) {
      if ((error as any)?.name === 'ZodError') {
        res
          .status(400)
          .json({ message: 'Invalid data', details: (error as any).errors });
        return;
      }

      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // PATCH /api/reviews/:reviewId/comments/:commentId
  async patch(req: Request, res: Response): Promise<void> {
    try {
      const params: ReviewCommentWithIdParamsDto =
        (res.locals?.validated?.params as ReviewCommentWithIdParamsDto) ??
        ReviewCommentWithIdParamsSchema.parse(req.params);

      const body: ReviewCommentUpdateDto =
        (res.locals?.validated?.body as ReviewCommentUpdateDto) ??
        ReviewCommentUpdateSchema.parse(req.body);

      const { reviewId, commentId } = params;

      const authReq = req as AuthenticatedRequest;
      const authUser = authReq.user;

      if (!authUser) {
        res.status(401).json({ message: 'Not authenticated' });
        return;
      }

      const existing = await this.repository.findById(commentId);
      if (!existing || existing.reviewId !== reviewId) {
        res.status(404).json({ message: 'Comment not found' });
        return;
      }

      const currentUserId = Number(authUser.sub);
      const isOwner = existing.userId === currentUserId;
      const isAdmin = authUser.roles?.includes('ADMIN') ?? false;

      if (!isOwner && !isAdmin) {
        res
          .status(403)
          .json({ message: 'Not authorized to modify this comment' });
        return;
      }

      const patched = await this.repository.update(commentId, body);

      if (!patched) {
        res.status(404).json({ message: 'Comment not found' });
        return;
      }

      res.json(patched);
    } catch (error) {
      if (error instanceof Error && (error as any).name === 'ZodError') {
        res
          .status(400)
          .json({ message: 'Invalid data', details: (error as any).errors });
        return;
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // DELETE /api/reviews/:reviewId/comments/:commentId
  async delete(req: Request, res: Response): Promise<void> {
    const params: ReviewCommentWithIdParamsDto =
      (res.locals?.validated?.params as ReviewCommentWithIdParamsDto) ??
      ReviewCommentWithIdParamsSchema.parse(req.params);

    const { reviewId, commentId } = params;

    const authReq = req as AuthenticatedRequest;
    const authUser = authReq.user;

    if (!authUser) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    const existing = await this.repository.findById(commentId);
    if (!existing || existing.reviewId !== reviewId) {
      res.status(404).json({ message: 'Comment not found' });
      return;
    }

    const currentUserId = Number(authUser.sub);
    const isOwner = existing.userId === currentUserId;
    const isAdmin = authUser.roles?.includes('ADMIN') ?? false;

    if (!isOwner && !isAdmin) {
      res
        .status(403)
        .json({ message: 'Not authorized to delete this comment' });
      return;
    }

    const deleted = await this.repository.delete(commentId, reviewId);

    if (!deleted) {
      res.status(404).json({ message: 'Comment not found' });
      return;
    }

    res.status(204).send();
  }
}
