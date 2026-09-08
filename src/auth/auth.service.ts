import jwt, { type SignOptions, type Secret } from 'jsonwebtoken';
import { verifyPassword } from '../common/password.util.js';
import type { UserRepository } from '../user/user.repository.interface.js';
import type { AuthLoginDto } from './validators/auth.validation.js';
import type { AuthLoginResponse, AuthUser } from './auth.entity.js';
import type { User } from '../user/user.entity.js';

const DEFAULT_EXP_HOURS = 4; // sin rememberMe
const REMEMBER_ME_EXP_DAYS = 30; // con rememberMe

export class AuthService {
  constructor(private readonly userRepository: UserRepository) {}

  private getJwtSecret(): Secret {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not defined');
    }
    return secret;
  }

  private toAuthUser(user: User): AuthUser {
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

  async login(dto: AuthLoginDto): Promise<AuthLoginResponse> {
    const { usernameOrEmail, password, rememberMe } = dto;

    if (!usernameOrEmail || !password) {
      throw new Error('INVALID_DATA');
    }

    const identifier = usernameOrEmail.trim();

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
      throw new Error('INVALID_CREDENTIALS');
    }

    const validPassword = await verifyPassword(password, user.passwordHash);
    if (!validPassword) {
      throw new Error('INVALID_CREDENTIALS');
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
}
