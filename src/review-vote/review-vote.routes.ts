import { Router } from 'express';
import { validateBody, validateParams } from '../shared/middlewares/validate.js';
import type { AuthMiddleware } from '../shared/middlewares/auth.js';
import { ReviewVoteController } from './review-vote.controller.js';
import { ReviewVoteParamsSchema, ReviewVoteBodySchema } from './dto/review-vote.dto.js';
import type { ReviewVoteService } from './review-vote.service.js';

export default function buildReviewVoteRouter(service: ReviewVoteService, auth: AuthMiddleware) {
  const router = Router({ mergeParams: true });
  const controller = new ReviewVoteController(service);

  // GET resumen de votos - público
  // GET /api/reviews/:reviewId/votes
  router.get(
    '/',
    auth.optionalAuth,
    validateParams(ReviewVoteParamsSchema),
    controller.getSummary.bind(controller),
  );

  // POST upvote / downvote (requiere login)
  // POST /api/reviews/:reviewId/votes
  router.post(
    '/',
    auth.requireAuth,
    validateParams(ReviewVoteParamsSchema),
    validateBody(ReviewVoteBodySchema),
    controller.upsert.bind(controller),
  );

  // DELETE quitar voto (requiere login, sin body)
  // DELETE /api/reviews/:reviewId/votes
  router.delete(
    '/',
    auth.requireAuth,
    validateParams(ReviewVoteParamsSchema),
    controller.remove.bind(controller),
  );

  return router;
}
