import type { Request, Response } from 'express';
import { UserService } from './user.service.js';
import {
  UserCreateSchema,
  UserUpdateSchema,
  UserIdParamSchema,
  UserListQuerySchema,
  UserRolesUpdateSchema,
  type UserCreateDto,
  type UserUpdateDto,
  type UserIdParamDto,
  type UserListQueryDto,
  type UserRolesUpdateDto,
} from './validators/user.validation.js';
import type { AuthenticatedRequest } from '../shared/middlewares/auth.js';

export class UserController {
  constructor(private readonly service: UserService) {}

  // POST /api/users (ADMIN crea usuarios)
  async create(req: Request, res: Response) {
    const body: UserCreateDto =
      (res.locals?.validated?.body as UserCreateDto) ??
      UserCreateSchema.parse(req.body);

    try {
      const user = await this.service.create(body);
      return res.status(201).json(user);
    } catch (error) {
      if (error instanceof Error && error.message === 'USER_ALREADY_EXISTS') {
        return res
          .status(409)
          .json({ error: 'El nombre de usuario o email ya existen' });
      }
      return res.status(500).json({ error: 'Error al crear usuario' });
    }
  }

  // GET /api/users (ADMIN)
  async list(req: Request, res: Response) {
    const query: UserListQueryDto =
      (res.locals?.validated?.query as UserListQueryDto) ??
      UserListQuerySchema.parse(req.query);

    const result = await this.service.list(query);
    return res.json(result);
  }

  // GET /api/users/:id (ADMIN)
  async getById(req: Request, res: Response) {
    const params: UserIdParamDto =
      (res.locals?.validated?.params as UserIdParamDto) ??
      UserIdParamSchema.parse(req.params);

    const user = await this.service.findById(params.id);

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    return res.json(user);
  }

  // GET /api/users/profile/:id -> perfil público
  async getProfileById(req: Request, res: Response) {
    const params: UserIdParamDto =
      (res.locals?.validated?.params as UserIdParamDto) ??
      UserIdParamSchema.parse(req.params);

    const profile = await this.service.getPublicProfile(params.id);

    if (!profile) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    return res.json(profile);
  }

  // PATCH /api/users/:id (dueño o ADMIN)
  async update(req: Request, res: Response) {
    const params: UserIdParamDto =
      (res.locals?.validated?.params as UserIdParamDto) ??
      UserIdParamSchema.parse(req.params);

    const body: UserUpdateDto =
      (res.locals?.validated?.body as UserUpdateDto) ??
      UserUpdateSchema.parse(req.body);

    const authReq = req as AuthenticatedRequest;
    const authUser = authReq.user;

    if (!authUser) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const currentUserId = Number(authUser.sub);
    const isOwner = currentUserId === params.id;
    const isAdmin = authUser.roles?.includes('ADMIN') ?? false;

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        error: 'No estás autorizado para modificar este usuario',
      });
    }

    // Detectar intento de tocar roles o isActive siendo NO admin
    const wantsToChangeRoles = (body as any).roles !== undefined;
    const wantsToChangeIsActive = body.isActive !== undefined;

    if (!isAdmin && (wantsToChangeRoles || wantsToChangeIsActive)) {
      return res.status(403).json({
        error: 'No estás autorizado para modificar roles o estado del usuario',
      });
    }

    const updated = await this.service.update(params.id, body);

    if (!updated) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    return res.json(updated);
  }

  // PATCH /api/users/:id/roles (solo ADMIN)
  async updateRoles(req: Request, res: Response) {
    const params: UserIdParamDto =
      (res.locals?.validated?.params as UserIdParamDto) ??
      UserIdParamSchema.parse(req.params);

    const body: UserRolesUpdateDto =
      (res.locals?.validated?.body as UserRolesUpdateDto) ??
      UserRolesUpdateSchema.parse(req.body);

    const authReq = req as AuthenticatedRequest;
    const authUser = authReq.user;

    if (!authUser) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const isAdmin = authUser.roles?.includes('ADMIN') ?? false;

    if (!isAdmin) {
      return res.status(403).json({
        error: 'Solo un administrador puede modificar roles',
      });
    }

    const updated = await this.service.updateRoles(params.id, body.roles);

    if (!updated) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    return res.json(updated);
  }

  // DELETE /api/users/:id (ADMIN)
  async delete(req: Request, res: Response) {
    const params: UserIdParamDto =
      (res.locals?.validated?.params as UserIdParamDto) ??
      UserIdParamSchema.parse(req.params);

    const authReq = req as AuthenticatedRequest;
    const authUser = authReq.user;

    if (!authUser) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const isAdmin = authUser.roles?.includes('ADMIN') ?? false;

    if (!isAdmin) {
      return res.status(403).json({
        error: 'Solo un administrador puede modificar roles',
      });
    }

    const deleted = await this.service.delete(params.id);

    return deleted
      ? res.status(204).send()
      : res.status(404).json({ error: 'Usuario no encontrado' });
  }
}
