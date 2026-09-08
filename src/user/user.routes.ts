import { Router } from 'express';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../shared/middlewares/validate.js';
import {
  UserCreateSchema,
  UserUpdateSchema,
  UserIdParamSchema,
  UserListQuerySchema,
  UserRolesUpdateSchema,
} from './validators/user.validation.js';
import { UserController } from './user.controller.js';
import type { UserService } from './user.service.js';
import { requireRole, type AuthMiddleware } from '../shared/middlewares/auth.js';

export default function buildUserRouter(userService: UserService, auth: AuthMiddleware) {
  const router = Router();
  const controller = new UserController(userService);

  // Perfil público
  router.get(
    '/profile/:id',
    validateParams(UserIdParamSchema),
    controller.getProfileById.bind(controller),
  );

  // Crear usuario (ADMIN)
  router.post(
    '/',
    auth.requireAuth,
    requireRole('ADMIN'),
    validateBody(UserCreateSchema),
    controller.create.bind(controller),
  );

  // Listar usuarios (ADMIN)
  router.get(
    '/',
    auth.requireAuth,
    requireRole('ADMIN'),
    validateQuery(UserListQuerySchema),
    controller.list.bind(controller),
  );

  // Ver usuario (ADMIN)
  router.get(
    '/:id',
    auth.requireAuth,
    requireRole('ADMIN'),
    validateParams(UserIdParamSchema),
    controller.getById.bind(controller),
  );

  // Actualizar roles de usuario (solo ADMIN)
  router.patch(
    '/:id/roles',
    auth.requireAuth,
    requireRole('ADMIN'),
    validateParams(UserIdParamSchema),
    validateBody(UserRolesUpdateSchema),
    controller.updateRoles.bind(controller),
  );

  // Actualizar usuario (dueño o ADMIN)
  router.patch(
    '/:id',
    auth.requireAuth,
    validateParams(UserIdParamSchema),
    validateBody(UserUpdateSchema),
    controller.update.bind(controller),
  );

  // Eliminar usuario (ADMIN)
  router.delete(
    '/:id',
    auth.requireAuth,
    requireRole('ADMIN'),
    validateParams(UserIdParamSchema),
    controller.delete.bind(controller),
  );

  return router;
}
