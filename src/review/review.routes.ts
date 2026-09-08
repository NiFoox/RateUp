import { Router } from 'express';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../shared/middlewares/validate.js';
import type { AuthMiddleware } from '../shared/middlewares/auth.js';
import { ReviewController } from './review.controller.js';
import {
  ReviewCreateSchema,
  ReviewUpdateSchema,
  ReviewIdParamSchema,
  ReviewListQuerySchema,
} from './validators/review.validation.js';
import type { ReviewRepository } from './review.repository.interface.js';
import type { ReviewCommentRepository } from '../review-comment/review-comment.repository.interface.js';
import type { ReviewVoteRepository } from '../review-vote/review-vote.repository.interface.js';

export default function buildReviewRouter(
  reviewRepository: ReviewRepository,
  reviewCommentRepository: ReviewCommentRepository,
  reviewVoteRepository: ReviewVoteRepository,
  auth: AuthMiddleware,
) {
  const router = Router();
  const controller = new ReviewController(
    reviewRepository,
    reviewCommentRepository,
    reviewVoteRepository,
  );

  // Mis reseñas (usuario logueado) | antes de '/:id'
  router.get(
    '/me',
    auth.requireAuth,
    validateQuery(ReviewListQuerySchema),
    controller.listMine.bind(controller),
  );

  // Crear reseña (requiere login)
  router.post(
    '/',
    auth.requireAuth,
    validateBody(ReviewCreateSchema),
    controller.create.bind(controller),
  );

  // Listar reseñas públicas
  router.get(
    '/',
    auth.optionalAuth,
    validateQuery(ReviewListQuerySchema),
    controller.list.bind(controller),
  );

  // Obtener reseña con relaciones básicas
  router.get(
    '/:id/details',
    validateParams(ReviewIdParamSchema),
    controller.getWithRelations.bind(controller),
  );

  // Obtener reseña completa (full + comments + votes + userVote)
  router.get(
    '/:id/full',
    auth.optionalAuth,
    validateParams(ReviewIdParamSchema),
    controller.getFull.bind(controller),
  );

  // Obtener reseña por id - público
  router.get(
    '/:id',
    validateParams(ReviewIdParamSchema),
    controller.getById.bind(controller)
  );

  // Actualizar reseña (dueño o ADMIN)
  router.patch(
    '/:id',
    auth.requireAuth,
    validateParams(ReviewIdParamSchema),
    validateBody(ReviewUpdateSchema),
    controller.patch.bind(controller),
  );

  // Eliminar reseña (dueño o ADMIN)
  router.delete(
    '/:id',
    auth.requireAuth,
    validateParams(ReviewIdParamSchema),
    controller.delete.bind(controller),
  );

  return router;
}
