import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import express from 'express';
import jwt from 'jsonwebtoken';
import buildGameRouter from '../../src/game/game.routes.js';
import { GameService } from '../../src/game/game.service.js';
import { DomainError } from '../../src/shared/errors/domain-error.js';
import { httpErrorMiddleware } from '../../src/shared/errors/http-error.middleware.js';
import { makeGameRepository } from '../helpers/game-repository.js';
import { startHttpServer } from '../helpers/http-server.js';

describe('Games HTTP contract', () => {
  const repository = makeGameRepository();
  const game = { id: 10, name: 'Celeste', description: 'Plataformas', genre: 'Indie' };
  const input = { name: game.name, description: game.description, genre: game.genre };
  const secret = 'games-test-secret';
  const previousSecret = process.env.JWT_SECRET;
  let server: Awaited<ReturnType<typeof startHttpServer>>;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = secret;
    adminToken = jwt.sign({ sub: '1', email: 'admin@example.test', roles: ['ADMIN'] }, secret);
    userToken = jwt.sign({ sub: '2', email: 'user@example.test', roles: ['USER'] }, secret);
    const app = express();
    app.use(express.json());
    app.use('/api/games', buildGameRouter(new GameService(repository)));
    app.use(httpErrorMiddleware);
    server = await startHttpServer(app);
  });

  beforeEach(() => {
    for (const mock of Object.values(repository)) mock.mockReset();
    repository.findByName.mockResolvedValue(null);
    repository.findById.mockResolvedValue(game);
    repository.create.mockResolvedValue(game);
    repository.patch.mockResolvedValue(game);
    repository.getPaginated.mockResolvedValue({ data: [game], total: 7 });
    repository.getAll.mockResolvedValue([game]);
    repository.delete.mockResolvedValue(true);
  });

  afterAll(async () => {
    await server.close();
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  function request(path: string, method = 'GET', body?: unknown, token?: string) {
    return fetch(`${server.url}/api/games${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  }

  it('keeps the public paginated response consumed by Angular', async () => {
    const response = await request('');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ page: 1, limit: 20, total: 7, data: [game] });
  });

  it('treats the string all=false as paginated', async () => {
    const response = await request('?all=false&page=2&limit=3&search=cel&genre=Indie');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ page: 2, limit: 3, total: 7, data: [game] });
    expect(repository.getPaginated).toHaveBeenCalledWith(3, 3, { search: 'cel', genre: 'Indie' });
    expect(repository.getAll).not.toHaveBeenCalled();
  });

  it('keeps the array response for all=true and applies filters', async () => {
    const response = await request('?all=true&genre=Indie');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([game]);
    expect(repository.getAll).toHaveBeenCalledWith({ search: undefined, genre: 'Indie' });
  });

  it('treats empty optional query parameters as absent', async () => {
    const response = await request('?page=&limit=&all=&search=%20&genre=');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ page: 1, limit: 20 });
  });

  it.each([
    '?all=no',
    '?all=0',
    '?all=false&all=true',
    '?page=0',
    '?page=1.5',
    '?limit=101',
    '/0',
    '/1.5',
    '/2147483648',
  ])('rejects invalid parameters: %s', async (path) => {
    const response = await request(path);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(repository.findById).not.toHaveBeenCalled();
    expect(repository.getPaginated).not.toHaveBeenCalled();
    expect(repository.getAll).not.toHaveBeenCalled();
  });

  it('creates as admin and supplies a usable Location', async () => {
    const response = await request('', 'POST', { ...input, name: '  Celeste  ' }, adminToken);
    expect(response.status).toBe(201);
    expect(response.headers.get('location')).toBe('/api/games/10');
    expect(await response.json()).toEqual(game);
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining(input));
    const detail = await fetch(`${server.url}${response.headers.get('location')}`);
    expect(detail.status).toBe(200);
    expect(await detail.json()).toEqual(game);
  });

  it.each([
    { ...input, name: ' ' },
    { ...input, name: 'n'.repeat(256) },
    { ...input, genre: 'g'.repeat(101) },
    { ...input, id: 123 },
  ])('rejects invalid creation data before writing: %j', async (body) => {
    const response = await request('', 'POST', body, adminToken);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it.each(['POST', 'PATCH', 'DELETE'])(
    'protects %s operations for anonymous and ordinary users',
    async (method) => {
      const path = method === 'POST' ? '' : '/10';
      const body = method === 'DELETE' ? undefined : input;
      expect((await request(path, method, body)).status).toBe(401);
      expect((await request(path, method, body, userToken)).status).toBe(403);
      expect((await request(path, method, body, 'invalid-token')).status).toBe(401);
      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.patch).not.toHaveBeenCalled();
      expect(repository.delete).not.toHaveBeenCalled();
    },
  );

  it('returns a 409 conflict for an existing name', async () => {
    repository.findByName.mockResolvedValue(game);
    const response = await request('', 'POST', input, adminToken);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      code: 'GAME_NAME_TAKEN',
      message: 'El nombre del juego ya está en uso.',
      field: 'name',
    });
  });

  it('preserves a conflict detected during the database write', async () => {
    repository.create.mockRejectedValue(
      new DomainError('GAME_NAME_TAKEN', 'El nombre del juego ya está en uso.', 409, 'name'),
    );
    const response = await request('', 'POST', input, adminToken);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'GAME_NAME_TAKEN' });
  });

  it('keeps an empty PATCH as a successful no-op', async () => {
    const response = await request('/10', 'PATCH', {}, adminToken);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(game);
    expect(repository.patch).toHaveBeenCalledWith(10, {});
  });

  it.each(['GET', 'PATCH', 'DELETE'])('reports a missing resource for %s', async (method) => {
    repository.findById.mockResolvedValue(null);
    repository.patch.mockResolvedValue(null);
    repository.delete.mockResolvedValue(false);
    const response = await request('/99', method, method === 'PATCH' ? {} : undefined, adminToken);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      code: 'GAME_NOT_FOUND',
      message: 'Juego no encontrado',
    });
  });

  it('returns no body after deletion', async () => {
    const response = await request('/10', 'DELETE', undefined, adminToken);
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
  });
});
