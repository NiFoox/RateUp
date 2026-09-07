import { jest } from '@jest/globals';
import type { GameRepository } from '../../src/game/game.repository.interface.js';

export function makeGameRepository(): jest.Mocked<GameRepository> {
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
