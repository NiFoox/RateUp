import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import { z } from 'zod';
import { DomainError } from '../../src/shared/errors/domain-error.js';
import { httpErrorMiddleware } from '../../src/shared/errors/http-error.middleware.js';
import { logger } from '../../src/shared/logger.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../src/shared/middlewares/validate.js';
import { startHttpServer } from '../helpers/http-server.js';

describe('HTTP error handling and validation', () => {
  let server: Awaited<ReturnType<typeof startHttpServer>>;
  const unexpectedError = new Error('Private database diagnostic');
  const logError = jest.spyOn(logger, 'error').mockImplementation(() => {});

  beforeAll(async () => {
    const app = express();
    app.use(express.json({ limit: '1kb' }));
    app.get('/domain', async () => {
      throw new DomainError(
        'USERNAME_TAKEN',
        'Ese nombre de usuario ya está en uso.',
        409,
        'username',
      );
    });
    app.get('/unexpected', async () => {
      throw unexpectedError;
    });
    app.post(
      '/validated/:id',
      validateParams(z.object({ id: z.coerce.number().int().positive() })),
      validateQuery(z.object({ page: z.coerce.number().int().positive().default(1) })),
      validateBody(z.strictObject({ name: z.string().trim().min(1) })),
      (_req, res) => res.json(res.locals.validated),
    );
    app.use(httpErrorMiddleware);
    server = await startHttpServer(app);
  });

  afterAll(async () => {
    await server.close();
    logError.mockRestore();
  });

  it('preserves the conflict fields consumed by the profile form', async () => {
    const response = await fetch(`${server.url}/domain`);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      code: 'USERNAME_TAKEN',
      message: 'Ese nombre de usuario ya está en uso.',
      field: 'username',
    });
  });

  it('logs unexpected async errors without returning internal details', async () => {
    const response = await fetch(`${server.url}/unexpected`);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
    expect(logError).toHaveBeenCalledWith({ err: unexpectedError }, 'Unhandled error');
  });

  it('makes parsed body, params and query available together', async () => {
    const response = await fetch(`${server.url}/validated/12?page=2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '  Celeste  ' }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      params: { id: 12 },
      query: { page: 2 },
      body: { name: 'Celeste' },
    });
  });

  it.each([
    ['/validated/0?page=1', { name: 'Celeste' }, 'id'],
    ['/validated/1?page=0', { name: 'Celeste' }, 'page'],
    ['/validated/1?page=1', { name: '   ' }, 'name'],
  ])('returns useful validation issues for %s', async (path, body, field) => {
    const response = await fetch(`${server.url}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      message: 'Validation error',
      code: 'VALIDATION_ERROR',
      formErrors: [],
      fieldErrors: { [field]: expect.arrayContaining([expect.any(String)]) },
    });
  });

  it('classifies malformed JSON as a client error', async () => {
    const response = await fetch(`${server.url}/validated/1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{broken',
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: 'INVALID_JSON', message: 'Invalid JSON body' });
  });

  it('keeps the body size limit as a 413 response', async () => {
    const response = await fetch(`${server.url}/validated/1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'a'.repeat(2048) }),
    });
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request body too large',
    });
  });
});
