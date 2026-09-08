import type { Request, Response } from 'express';
import type { AuthService } from './auth.service.js';
import type { UserService } from '../user/user.service.js';
import {
  AuthLoginSchema,
  type AuthLoginDto,
} from './validators/auth.validation.js';
import {
  UserCreateSchema,
  type UserCreateDto,
} from '../user/validators/user.validation.js';
import type { AuthenticatedRequest } from '../shared/middlewares/auth.js';

export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  // POST /api/auth/login
  async login(req: Request, res: Response) {
    try {
      const dto: AuthLoginDto =
        (res.locals?.validated?.body as AuthLoginDto) ??
        AuthLoginSchema.parse(req.body);

      const result = await this.authService.login(dto);

      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'INVALID_DATA') {
          return res
            .status(400)
            .json({ error: 'Datos de login inválidos o incompletos' });
        }
        if (error.message === 'INVALID_CREDENTIALS') {
          return res
            .status(401)
            .json({ error: 'Credenciales inválidas' });
        }
        if (error.message === 'JWT_SECRET is not defined') {
          return res.status(500).json({
            error: 'Configuración de JWT incompleta (falta JWT_SECRET)',
          });
        }
      }

      return res.status(500).json({ error: 'Error interno de autenticación' });
    }
  }

  // POST /api/auth/register  (registro público, siempre rol USER)
  async register(req: Request, res: Response) {
    try {
      const dto: UserCreateDto =
        (res.locals?.validated?.body as UserCreateDto) ??
        UserCreateSchema.parse(req.body);

      const createdUser = await this.userService.create(dto);

      return res.status(201).json(createdUser);
    } catch (error) {
      if (error instanceof Error && error.message === 'USER_ALREADY_EXISTS') {
        return res.status(409).json({
          error: 'El nombre de usuario o email ya están registrados',
        });
      }

      if ((error as any)?.name === 'ZodError') {
        return res.status(400).json({
          error: 'Datos inválidos',
          details: (error as any).errors,
        });
      }

      return res.status(500).json({ error: 'Error al registrar usuario' });
    }
  }

  // GET /api/auth/me  (datos del usuario logueado usando sub)
  async me(req: Request, res: Response) {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const userId = Number(authReq.user.sub);

    if (!Number.isFinite(userId)) {
      return res.status(400).json({ error: 'Token inválido (sub inválido)' });
    }

    const profile = await this.userService.getPrivateProfile(userId);

    if (!profile) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    return res.json(profile);
  }
}
