import type { Request, Response } from 'express';
import type { UserService } from './user.service.js';
import type { UserCreateDto } from './dto/create-user.dto.js';
import type { UserAdminUpdateDto } from './dto/update-user.dto.js';
import type { UserIdParamDto } from './dto/user-id.dto.js';
import type { UserListQueryDto } from './dto/list-users.dto.js';
import type { UserRolesUpdateDto } from './dto/update-user-roles.dto.js';
import type { UserDto, UserListDto, PublicUserProfileDto } from './dto/user.dto.js';
import type { ValidatedLocals } from '../shared/middlewares/validate.js';
import type { AuthenticatedRequest } from '../shared/middlewares/auth.js';

export class UserController {
  constructor(private readonly service: UserService) {}

  async create(
    _req: Request,
    res: Response<UserDto, ValidatedLocals<{ body: UserCreateDto }>>,
  ): Promise<void> {
    res.status(201).json(await this.service.create(res.locals.validated.body));
  }

  async list(
    _req: Request,
    res: Response<UserListDto, ValidatedLocals<{ query: UserListQueryDto }>>,
  ): Promise<void> {
    res.json(await this.service.list(res.locals.validated.query));
  }

  async getById(
    _req: Request,
    res: Response<UserDto, ValidatedLocals<{ params: UserIdParamDto }>>,
  ): Promise<void> {
    res.json(await this.service.findById(res.locals.validated.params.id));
  }

  async getProfileById(
    _req: Request,
    res: Response<PublicUserProfileDto, ValidatedLocals<{ params: UserIdParamDto }>>,
  ): Promise<void> {
    res.json(await this.service.getPublicProfile(res.locals.validated.params.id));
  }

  async update(
    req: AuthenticatedRequest,
    res: Response<UserDto, ValidatedLocals<{ params: UserIdParamDto; body: UserAdminUpdateDto }>>,
  ): Promise<void> {
    const { params, body } = res.locals.validated;
    // requireAuth ya obtuvo la identidad y los roles vigentes.
    const actor = { id: Number(req.user!.sub), roles: req.user!.roles };
    res.json(await this.service.update(params.id, body, actor));
  }

  async updateRoles(
    _req: Request,
    res: Response<UserDto, ValidatedLocals<{ params: UserIdParamDto; body: UserRolesUpdateDto }>>,
  ): Promise<void> {
    const { params, body } = res.locals.validated;
    res.json(await this.service.updateRoles(params.id, body.roles));
  }

  async delete(
    _req: Request,
    res: Response<void, ValidatedLocals<{ params: UserIdParamDto }>>,
  ): Promise<void> {
    await this.service.delete(res.locals.validated.params.id);
    res.status(204).send();
  }
}
