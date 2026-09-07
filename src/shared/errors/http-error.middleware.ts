import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { DomainError } from './domain-error.js';
import { logger } from '../logger.js';

function isBodyParserError(error: unknown, type: string): boolean {
  return typeof error === 'object' && error !== null && 'type' in error && error.type === type;
}

export function httpErrorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof z.ZodError) {
    return res.status(400).json({
      message: 'Validation error',
      code: 'VALIDATION_ERROR',
      ...z.flattenError(err),
    });
  }

  if (err instanceof DomainError) {
    return res.status(err.httpStatus).json({
      message: err.message,
      code: err.code,
      field: err.field,
    });
  }

  if (isBodyParserError(err, 'entity.parse.failed')) {
    return res.status(400).json({ message: 'Invalid JSON body', code: 'INVALID_JSON' });
  }

  if (isBodyParserError(err, 'entity.too.large')) {
    return res.status(413).json({ message: 'Request body too large', code: 'PAYLOAD_TOO_LARGE' });
  }

  logger.error({ err }, 'Unhandled error');

  return res.status(500).json({
    message: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
}
