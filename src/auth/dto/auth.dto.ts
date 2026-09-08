import type { UserRole } from '../../user/user.entity.js';

export interface AuthUserDto {
  id: number;
  username: string;
  email: string;
  roles: UserRole[];
}

export interface AuthLoginResponseDto {
  success: true;
  accessToken: string;
  expiresAt: string;
  user: AuthUserDto;
}

// Contexto interno de la petición: roles y email provienen de la base vigente.
export interface AuthPrincipal {
  sub: string;
  email: string;
  roles: UserRole[];
}
