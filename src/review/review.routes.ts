import { Router } from 'express';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../shared/middlewares/validate.js';
import type { AuthMiddleware } from '../shared/middlewares/auth.js';
import { ReviewController } from './review.controller.js';
import { ReviewCreateSchema } from './dto/create-review.dto.js';
import { ReviewUpdateSchema } from './dto/update-review.dto.js';
import { ReviewIdParamSchema } from './dto/review-id.dto.js';
import { ReviewListQuerySchema } from './dto/list-reviews.dto.js';
import { ReviewFullQuerySchema } from './dto/full-review.dto.js';
import type { ReviewService } from './review.service.js';

export default function buildReviewRouter(service: ReviewService, auth: AuthMiddleware) {
  const router = Router();
  const controller = new ReviewController(service);

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
    validateQuery(ReviewFullQuerySchema),
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
