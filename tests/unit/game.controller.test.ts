import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response } from 'express';
import { GameController } from '../../src/game/game.controller.js';
import type { GameRepository } from '../../src/game/game.repository.interface.js';
import { Game } from '../../src/game/game.entity.js';

function makeRepoMock(): jest.Mocked<GameRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findByName: jest.fn(),
    getPaginated: jest.fn(),
    getAll: jest.fn(),
    getTopRatedGames: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  };
}

function makeRes() {
  const status = jest.fn().mockReturnThis();
  const json = jest.fn().mockReturnThis();
  const location = jest.fn().mockReturnThis();
  const send = jest.fn().mockReturnThis();
  const res = { status, json, location, send, locals: {} } as unknown as Response & {
    status: jest.Mock;
    json: jest.Mock;
    location: jest.Mock;
    send: jest.Mock;
    locals: any;
  };
  return { res, status, json, location, send };
}

describe('GameController', () => {
  let repo: jest.Mocked<GameRepository>;
  let controller: GameController;

  beforeEach(() => {
    repo = makeRepoMock();
    controller = new GameController(repo);
    jest.clearAllMocks();
  });

  // CREATE
  describe('create', () => {
    it('retorna 400 si el nombre ya existe', async () => {
      repo.findByName.mockResolvedValue({ id: 1, name: 'Zelda', description: '...', genre: 'RPG' });

      const req = {
        body: { name: 'Zelda', description: 'Nueva', genre: 'RPG' },
      } as unknown as Request;
      const { res, status, json } = makeRes();

      await controller.create(req, res);

      expect(repo.findByName).toHaveBeenCalledWith('Zelda');
      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({ error: 'El nombre ya existe' });
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('crea y retorna 201 con Location cuando el nombre no existe', async () => {
      repo.findByName.mockResolvedValue(null);
      repo.create.mockResolvedValue({
        id: 10,
        name: 'Celeste',
        description: 'Plataformas',
        genre: 'Indie',
      });

      const req = {
        body: { name: 'Celeste', description: 'Plataformas', genre: 'Indie' },
      } as unknown as Request;
      const { res, status, json, location } = makeRes();

      await controller.create(req, res);

      expect(repo.findByName).toHaveBeenCalledWith('Celeste');
      expect(repo.create).toHaveBeenCalledWith(new Game('Celeste', 'Plataformas', 'Indie'));
      expect(status).toHaveBeenCalledWith(201);
      expect(location).toHaveBeenCalledWith('/games/10');
      expect(json).toHaveBeenCalledWith({
        id: 10,
        name: 'Celeste',
        description: 'Plataformas',
        genre: 'Indie',
      });
    });
  });

  // READ: getById
  describe('getById', () => {
    it('retorna el juego si existe', async () => {
      repo.findById.mockResolvedValue({
        id: 2,
        name: 'Hades',
        description: 'ARPG',
        genre: 'Rogue',
      });

      const req = {} as Request;
      const { res, json } = makeRes();
      res.locals = { validated: { params: { id: 2 } } };

      await controller.getById(req, res);

      expect(repo.findById).toHaveBeenCalledWith(2);
      expect(json).toHaveBeenCalledWith({
        id: 2,
        name: 'Hades',
        description: 'ARPG',
        genre: 'Rogue',
      });
    });

    it('retorna 404 si no existe', async () => {
      repo.findById.mockResolvedValue(null);

      const req = {} as Request;
      const { res, status, json } = makeRes();
      res.locals = { validated: { params: { id: 999 } } };

      await controller.getById(req, res);

      expect(repo.findById).toHaveBeenCalledWith(999);
      expect(status).toHaveBeenCalledWith(404);
      expect(json).toHaveBeenCalledWith({ error: 'Juego no encontrado' });
    });
  });

  // READ: list
  describe('list', () => {
    it('retorna todos si all=true', async () => {
      repo.getAll.mockResolvedValue([{ id: 1, name: 'Zelda', description: '...', genre: 'RPG' }]);

      const req = {} as Request;
      const { res, json } = makeRes();
      res.locals = { validated: { query: { all: true } } };

      await controller.list(req, res);

      expect(repo.getAll).toHaveBeenCalled();
      expect(json).toHaveBeenCalledWith([
        { id: 1, name: 'Zelda', description: '...', genre: 'RPG' },
      ]);
    });

    it('retorna paginado si all=false', async () => {
      repo.getPaginated.mockResolvedValue({
        data: [{ id: 3, name: 'Gris', description: 'Arte', genre: 'Indie' }],
        total: 2,
      });

      const req = {} as Request;
      const { res, json } = makeRes();
      res.locals = {
        validated: { query: { all: false, page: 2, limit: 1, search: 'g', genre: 'Indie' } },
      };

      await controller.list(req, res);

      // page=2, limit=1 => offset = (2-1)*1 = 1
      expect(repo.getPaginated).toHaveBeenCalledWith(1, 1, { search: 'g', genre: 'Indie' });
      expect(json).toHaveBeenCalledWith({
        page: 2,
        limit: 1,
        total: 2,
        data: [{ id: 3, name: 'Gris', description: 'Arte', genre: 'Indie' }],
      });
    });
  });

  // UPDATE: patch
  describe('patch', () => {
    it('retorna el juego parchado si existe', async () => {
      repo.patch.mockResolvedValue({
        id: 5,
        name: 'Ori',
        description: 'Bellísimo',
        genre: 'Metroidvania',
      });

      const req = {
        body: { name: 'Ori', description: 'Bellísimo', genre: 'Metroidvania' },
      } as unknown as Request;
      const { res, json } = makeRes();
      res.locals = { validated: { params: { id: 5 } } };

      await controller.patch(req, res);

      expect(repo.patch).toHaveBeenCalledWith(5, new Game('Ori', 'Bellísimo', 'Metroidvania'));
      expect(json).toHaveBeenCalledWith({
        id: 5,
        name: 'Ori',
        description: 'Bellísimo',
        genre: 'Metroidvania',
      });
    });

    it('retorna 404 si no existe', async () => {
      repo.patch.mockResolvedValue(undefined);

      const req = {
        body: { name: 'NoExiste', description: 'x', genre: 'x' },
      } as unknown as Request;
      const { res, status, json } = makeRes();
      res.locals = { validated: { params: { id: 123 } } };

      await controller.patch(req, res);

      expect(status).toHaveBeenCalledWith(404);
      expect(json).toHaveBeenCalledWith({ error: 'Juego no encontrado' });
    });
  });

  // DELETE
  describe('delete', () => {
    it('retorna 204 si elimina', async () => {
      repo.delete.mockResolvedValue(true);

      const req = {} as Request;
      const { res, status, send } = makeRes();
      res.locals = { validated: { params: { id: 7 } } };

      await controller.delete(req, res);

      expect(repo.delete).toHaveBeenCalledWith(7);
      expect(status).toHaveBeenCalledWith(204);
      expect(send).toHaveBeenCalled();
    });

    it('retorna 404 si no existe', async () => {
      repo.delete.mockResolvedValue(false);

      const req = {} as Request;
      const { res, status, json } = makeRes();
      res.locals = { validated: { params: { id: 404 } } };

      await controller.delete(req, res);

      expect(status).toHaveBeenCalledWith(404);
      expect(json).toHaveBeenCalledWith({ error: 'Juego no encontrado' });
    });
  });
});
