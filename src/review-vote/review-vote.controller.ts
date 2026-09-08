import { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../shared/middlewares/auth.js';
import type { ReviewVoteRepository } from './review-vote.repository.interface.js';
import {
  ReviewVoteParamsSchema,
  ReviewVoteBodySchema,
  type ReviewVoteParamsDto,
  type ReviewVoteBodyDto,
} from './validators/review-vote.validation.js';

export class ReviewVoteController {
  constructor(private readonly repository: ReviewVoteRepository) {}

  // GET /api/reviews/:reviewId/votes
  async getSummary(req: Request, res: Response): Promise<void> {
    const params: ReviewVoteParamsDto =
      (res.locals?.validated?.params as ReviewVoteParamsDto) ??
      ReviewVoteParamsSchema.parse(req.params);

    const { reviewId } = params;

    const summary = await this.repository.getSummary(reviewId);

    const authReq = req as AuthenticatedRequest;
    const authUser = authReq.user;

    let userVote: -1 | 0 | 1 = 0;
    if (authUser) {
      const userId = Number(authUser.sub);
      userVote = await this.repository.getUserVote(reviewId, userId);
    }

    res.json({
      reviewId,
      ...summary,
      userVote,
    });
  }

  // POST /api/reviews/:reviewId/votes
  async upsert(req: Request, res: Response): Promise<void> {
    try {
      const params: ReviewVoteParamsDto =
        (res.locals?.validated?.params as ReviewVoteParamsDto) ??
        ReviewVoteParamsSchema.parse(req.params);

      const body: ReviewVoteBodyDto =
        (res.locals?.validated?.body as ReviewVoteBodyDto) ??
        ReviewVoteBodySchema.parse(req.body);

      const { reviewId } = params;
      const { value } = body;

      const authReq = req as AuthenticatedRequest;
      const authUser = authReq.user;

      if (!authUser) {
        res.status(401).json({ message: 'Not authenticated' });
        return;
      }

      const userId = Number(authUser.sub);

      const vote = await this.repository.upsertVote(reviewId, userId, value);
      const summary = await this.repository.getSummary(reviewId);

      res.status(200).json({
        reviewId,
        userId,
        value: vote.value,
        ...summary,
      });
    } catch (error: any) {
        if (error?.name === 'ZodError') {
          res.status(400).json({ 
            message: 'Invalid data', 
            details: error.errors 
          });
          return;
        }

        if (error?.code === '23503') {
          // foreign key violation
          res.status(404).json({ message: 'Review not found' });
          return;
        }

        console.error('Error en ReviewVoteController.upsert:', error);
        res.status(500).json({ message: 'Internal server error' });
      }
  }

  // DELETE /api/reviews/:reviewId/votes
  async remove(req: Request, res: Response): Promise<void> {
    try {
      const params: ReviewVoteParamsDto =
        (res.locals?.validated?.params as ReviewVoteParamsDto) ??
        ReviewVoteParamsSchema.parse(req.params);

      const { reviewId } = params;

      const authReq = req as AuthenticatedRequest;
      const authUser = authReq.user;

      if (!authUser) {
        res.status(401).json({ message: 'Not authenticated' });
        return;
      }

      const userId = Number(authUser.sub);

      const deleted = await this.repository.deleteVote(reviewId, userId);
      const summary = await this.repository.getSummary(reviewId);

      res.status(200).json({
        reviewId,
        deleted,
        ...summary,
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
}
