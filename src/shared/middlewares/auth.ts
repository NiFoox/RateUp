import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { AuthService } from '../../auth/auth.service.js';
import type { AuthPrincipal } from '../../auth/dto/auth.dto.js';
import type { UserRole } from '../../user/user.entity.js';
import { DomainError } from '../errors/domain-error.js';

export interface AuthenticatedRequest extends Request {
  user?: AuthPrincipal;
}

export interface AuthMiddleware {
  requireAuth: RequestHandler;
  optionalAuth: RequestHandler;
}

export function buildAuthMiddleware(service: AuthService): AuthMiddleware {
  function authenticate(required: boolean): RequestHandler {
    return async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
      const header = req.headers.authorization;
      const token = header?.startsWith('Bearer ') ? header.substring('Bearer '.length) : undefined;
      const user = token ? await service.authenticate(token) : null;
      req.user = user ?? undefined;

      if (required && !user) {
        throw new DomainError('UNAUTHENTICATED', 'No autenticado o sesión inválida', 401);
      }

      next();
    };
  }

  // En endpoints públicos, una sesión inválida se trata como anónima.
  // Los errores de infraestructura se propagan al middleware común, no se ocultan.
  return { requireAuth: authenticate(true), optionalAuth: authenticate(false) };
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new DomainError('UNAUTHENTICATED', 'No autenticado', 401);
    }
    if (!req.user.roles.some((role) => roles.includes(role))) {
      throw new DomainError('FORBIDDEN', 'No autorizado', 403);
    }
    next();
  };
}
