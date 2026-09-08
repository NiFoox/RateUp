import { Router } from 'express';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../shared/middlewares/validate.js';
import type { AuthMiddleware } from '../shared/middlewares/auth.js';
import { ReviewCommentController } from './review-comment.controller.js';
import {
  ReviewCommentBaseParamsSchema,
  ReviewCommentWithIdParamsSchema,
  ReviewCommentCreateSchema,
  ReviewCommentUpdateSchema,
  ReviewCommentListQuerySchema,
} from './validators/review-comment.validation.js';
import type { ReviewCommentRepository } from './review-comment.repository.interface.js';

export default function buildReviewCommentRouter(
  repository: ReviewCommentRepository,
  auth: AuthMiddleware,
) {
  // mergeParams opcional.
  const router = Router({ mergeParams: true });
  const controller = new ReviewCommentController(repository);

  // POST /api/reviews/:reviewId/comments (requiere login)
  router.post(
    '/',
    auth.requireAuth,
    validateParams(ReviewCommentBaseParamsSchema),
    validateBody(ReviewCommentCreateSchema),
    controller.create.bind(controller),
  );

  // GET /api/reviews/:reviewId/comments - público
  router.get(
    '/',
    validateParams(ReviewCommentBaseParamsSchema),
    validateQuery(ReviewCommentListQuerySchema),
    controller.list.bind(controller),
  );

  // GET /api/reviews/:reviewId/comments/details - público
  router.get(
    '/details',
    validateParams(ReviewCommentBaseParamsSchema),
    validateQuery(ReviewCommentListQuerySchema),
    controller.listWithUser.bind(controller),
  );

  // PATCH /api/reviews/:reviewId/comments/:commentId (requiere login)
  router.patch(
    '/:commentId',
    auth.requireAuth,
    validateParams(ReviewCommentWithIdParamsSchema),
    validateBody(ReviewCommentUpdateSchema),
    controller.patch.bind(controller),
  );

  // DELETE /api/reviews/:reviewId/comments/:commentId (requiere login)
  router.delete(
    '/:commentId',
    auth.requireAuth,
    validateParams(ReviewCommentWithIdParamsSchema),
    controller.delete.bind(controller),
  );

  return router;
}
