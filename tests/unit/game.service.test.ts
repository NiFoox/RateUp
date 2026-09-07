import { beforeEach, describe, expect, it } from '@jest/globals';
import { GameService } from '../../src/game/game.service.js';
import { makeGameRepository } from '../helpers/game-repository.js';

describe('GameService', () => {
  let repository: ReturnType<typeof makeGameRepository>;
  let service: GameService;
  const game = { id: 10, name: 'Celeste', description: 'Plataformas', genre: 'Indie' };
  const input = { name: game.name, description: game.description, genre: game.genre };

  beforeEach(() => {
    repository = makeGameRepository();
    service = new GameService(repository);
  });

  it('creates a game when the name is available', async () => {
    repository.findByName.mockResolvedValue(null);
    repository.create.mockResolvedValue(game);
    await expect(service.create(input)).resolves.toEqual(game);
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining(input));
  });

  it('rejects duplicate names before writing', async () => {
    repository.findByName.mockResolvedValue(game);
    await expect(service.create(input)).rejects.toMatchObject({
      code: 'GAME_NAME_TAKEN',
      httpStatus: 409,
      field: 'name',
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('returns a stored game by id', async () => {
    repository.findById.mockResolvedValue(game);
    await expect(service.getById(10)).resolves.toEqual(game);
  });

  it('reports a missing game consistently', async () => {
    repository.findById.mockResolvedValue(null);
    repository.patch.mockResolvedValue(null);
    repository.delete.mockResolvedValue(false);
    for (const operation of [service.getById(99), service.patch(99, {}), service.delete(99)]) {
      await expect(operation).rejects.toMatchObject({ code: 'GAME_NOT_FOUND', httpStatus: 404 });
    }
  });

  it('returns the full filtered total independently of the page length', async () => {
    repository.getPaginated.mockResolvedValue({ data: [game], total: 8 });
    await expect(
      service.list({ page: 2, limit: 3, all: false, search: 'cel', genre: 'Indie' }),
    ).resolves.toEqual({ page: 2, limit: 3, total: 8, data: [game] });
    expect(repository.getPaginated).toHaveBeenCalledWith(3, 3, { search: 'cel', genre: 'Indie' });
  });

  it('uses the same filters for the unpaginated list', async () => {
    repository.getAll.mockResolvedValue([game]);
    await expect(service.list({ page: 1, limit: 20, all: true, genre: 'Indie' })).resolves.toEqual([
      game,
    ]);
    expect(repository.getAll).toHaveBeenCalledWith({ search: undefined, genre: 'Indie' });
    expect(repository.getPaginated).not.toHaveBeenCalled();
  });

  it('updates only the supplied fields', async () => {
    repository.patch.mockResolvedValue({ ...game, description: 'Nueva descripción' });
    await expect(service.patch(10, { description: 'Nueva descripción' })).resolves.toMatchObject({
      description: 'Nueva descripción',
    });
    expect(repository.patch).toHaveBeenCalledWith(10, { description: 'Nueva descripción' });
  });

  it('preserves the documented empty PATCH behavior', async () => {
    repository.patch.mockResolvedValue(game);
    await expect(service.patch(10, {})).resolves.toEqual(game);
    expect(repository.patch).toHaveBeenCalledWith(10, {});
  });

  it('completes a successful deletion', async () => {
    repository.delete.mockResolvedValue(true);
    await expect(service.delete(10)).resolves.toBeUndefined();
    expect(repository.delete).toHaveBeenCalledWith(10);
  });
});
