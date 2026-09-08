import type { Request, Response } from 'express';
import type { AuthService } from './auth.service.js';
import type { AuthLoginDto } from './dto/login.dto.js';
import type { AuthRegisterDto } from './dto/register.dto.js';
import type { AuthLoginResponseDto } from './dto/auth.dto.js';
import type { UserDto, PrivateUserProfileDto } from '../user/dto/user.dto.js';
import type { ValidatedLocals } from '../shared/middlewares/validate.js';
import type { AuthenticatedRequest } from '../shared/middlewares/auth.js';

export class AuthController {
  constructor(private readonly service: AuthService) {}

  async login(
    _req: Request,
    res: Response<AuthLoginResponseDto, ValidatedLocals<{ body: AuthLoginDto }>>,
  ): Promise<void> {
    res.json(await this.service.login(res.locals.validated.body));
  }

  async register(
    _req: Request,
    res: Response<UserDto, ValidatedLocals<{ body: AuthRegisterDto }>>,
  ): Promise<void> {
    res.status(201).json(await this.service.register(res.locals.validated.body));
  }

  async me(req: AuthenticatedRequest, res: Response<PrivateUserProfileDto>): Promise<void> {
    // requireAuth garantiza un principal con sub válido antes de llegar aquí.
    res.json(await this.service.getProfile(Number(req.user!.sub)));
  }
}
