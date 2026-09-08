import { Router } from 'express';
import { validateBody } from '../shared/middlewares/validate.js';
import type { AuthMiddleware } from '../shared/middlewares/auth.js';
import { AuthController } from './auth.controller.js';
import type { AuthService } from './auth.service.js';
import { AuthLoginSchema } from './dto/login.dto.js';
import { AuthRegisterSchema } from './dto/register.dto.js';

export default function buildAuthRouter(service: AuthService, auth: AuthMiddleware) {
  const router = Router();
  const controller = new AuthController(service);

  router.post('/login', validateBody(AuthLoginSchema), controller.login.bind(controller));
  router.post('/register', validateBody(AuthRegisterSchema), controller.register.bind(controller));
  router.get('/me', auth.requireAuth, controller.me.bind(controller));

  return router;
}
