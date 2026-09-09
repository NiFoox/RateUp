import { Router } from 'express';
import { validateBody, validateParams, validateQuery } from '../shared/middlewares/validate.js';
import type { AuthMiddleware } from '../shared/middlewares/auth.js';
import { ReviewCommentController } from './review-comment.controller.js';
import {
  ReviewCommentBaseParamsSchema,
  ReviewCommentWithIdParamsSchema,
} from './dto/comment-params.dto.js';
import { ReviewCommentCreateSchema } from './dto/create-comment.dto.js';
import { ReviewCommentUpdateSchema } from './dto/update-comment.dto.js';
import { ReviewCommentListQuerySchema } from './dto/list-comments.dto.js';
import type { ReviewCommentService } from './review-comment.service.js';

export default function buildReviewCommentRouter(
  service: ReviewCommentService,
  auth: AuthMiddleware,
) {
  const router = Router({ mergeParams: true });
  const controller = new ReviewCommentController(service);

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
