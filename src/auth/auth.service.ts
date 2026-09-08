import jwt, { type SignOptions, type Secret } from 'jsonwebtoken';
import { verifyPassword } from '../common/password.util.js';
import type { UserRepository } from '../user/user.repository.interface.js';
import type { AuthLoginDto } from './dto/login.dto.js';
import type { AuthRegisterDto } from './dto/register.dto.js';
import type { AuthLoginResponseDto, AuthUserDto, AuthPrincipal } from './dto/auth.dto.js';
import type { UserService, UserDto, PrivateUserProfileDto } from '../user/user.service.js';
import { DomainError } from '../shared/errors/domain-error.js';
import type { User } from '../user/user.entity.js';

const DEFAULT_EXP_HOURS = 4; // sin rememberMe
const REMEMBER_ME_EXP_DAYS = 30; // con rememberMe

export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly userService: UserService,
  ) {}

  private getJwtSecret(): Secret {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not defined');
    }
    return secret;
  }

  private toAuthUser(user: User): AuthUserDto {
    if (user.id == null) {
      throw new Error('INVALID_DATA');
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      roles: user.roles,
    };
  }

  private resolveExpires(
    rememberMe?: boolean,
  ): { expiresAt: string; expiresIn: SignOptions['expiresIn'] } {
    const now = Date.now();

    const ms =
      (rememberMe ? REMEMBER_ME_EXP_DAYS * 24 * 60 * 60 : DEFAULT_EXP_HOURS * 60 * 60) *
      1000;

    const expiresAt = new Date(now + ms).toISOString();
    const expiresIn: SignOptions['expiresIn'] = rememberMe ? '30d' : '4h';

    return { expiresAt, expiresIn };
  }

  async login(dto: AuthLoginDto): Promise<AuthLoginResponseDto> {
    const { usernameOrEmail, password, rememberMe } = dto;

    const identifier = usernameOrEmail;

    let user =
      (identifier.includes('@')
        ? await this.userRepository.findByEmail(identifier)
        : await this.userRepository.findByUsername(identifier)) ?? null;

    // fallback por si el criterio anterior no matchea
    if (!user) {
      user =
        (await this.userRepository.findByEmail(identifier)) ??
        (await this.userRepository.findByUsername(identifier)) ??
        null;
    }

    if (!user || !user.isActive) {
      throw new DomainError('INVALID_CREDENTIALS', 'Credenciales inválidas', 401);
    }

    const validPassword = await verifyPassword(password, user.passwordHash);
    if (!validPassword) {
      throw new DomainError('INVALID_CREDENTIALS', 'Credenciales inválidas', 401);
    }

    const authUser = this.toAuthUser(user);
    const { expiresAt, expiresIn } = this.resolveExpires(rememberMe);
    const secret = this.getJwtSecret();

    const payload = {
      sub: String(authUser.id),
      email: authUser.email,
      roles: authUser.roles,
    };

    const signOptions: SignOptions = {
      expiresIn,
    };

    const accessToken = jwt.sign(payload, secret, signOptions);

    return {
      success: true,
      accessToken,
      expiresAt,
      user: authUser,
    };
  }

  async register(dto: AuthRegisterDto): Promise<UserDto> {
    try {
      return await this.userService.create({
        username: dto.username,
        email: dto.email,
        password: dto.password,
        roles: ['USER'],
        isActive: true,
      });
    } catch (error) {
      // Adaptación del servicio existente; la creación administrativa conserva su contrato.
      if (error instanceof Error && error.message === 'USER_ALREADY_EXISTS') {
        throw new DomainError(
          'USER_ALREADY_EXISTS',
          'El nombre de usuario o email ya están registrados',
          409,
        );
      }
      throw error;
    }
  }

  async authenticate(token: string): Promise<AuthPrincipal | null> {
    const secret = this.getJwtSecret();
    let decoded: string | jwt.JwtPayload;
    try {
      decoded = jwt.verify(token, secret);
    } catch (error) {
      if (
        error instanceof jwt.JsonWebTokenError ||
        error instanceof jwt.TokenExpiredError ||
        error instanceof jwt.NotBeforeError
      ) {
        return null;
      }
      throw error;
    }

    if (typeof decoded !== 'object' || typeof decoded.sub !== 'string') return null;
    const userId = Number(decoded.sub);
    if (
      !/^\d+$/.test(decoded.sub) ||
      !Number.isInteger(userId) ||
      userId < 1 ||
      userId > 2_147_483_647
    ) {
      return null;
    }

    // Solo sub identifica la cuenta: no autorizamos con roles/email antiguos del JWT.
    const user = await this.userRepository.findById(userId);
    if (!user || !user.isActive) return null;

    return { sub: String(userId), email: user.email, roles: user.roles };
  }

  async getProfile(userId: number): Promise<PrivateUserProfileDto> {
    const profile = await this.userService.getPrivateProfile(userId);
    if (!profile) {
      throw new DomainError('USER_NOT_FOUND', 'Usuario no encontrado', 404);
    }
    return profile;
  }
}
