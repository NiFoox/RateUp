import { DomainError } from '../shared/errors/domain-error.js';
import { Game } from './game.entity.js';
import type { GameRepository } from './game.repository.interface.js';
import type { GameCreateDto } from './dto/create-game.dto.js';
import type { GameUpdateDto } from './dto/update-game.dto.js';
import type { GameListQueryDto } from './dto/list-games.dto.js';
import type { GameDto, GameListDto } from './dto/game.dto.js';

export class GameService {
  constructor(private readonly repository: GameRepository) {}

  async create(dto: GameCreateDto): Promise<GameDto> {
    if (await this.repository.findByName(dto.name)) {
      throw new DomainError('GAME_NAME_TAKEN', 'El nombre del juego ya está en uso.', 409, 'name');
    }

    return this.repository.create(new Game(dto.name, dto.description, dto.genre));
  }

  async getById(id: number): Promise<GameDto> {
    const game = await this.repository.findById(id);
    if (!game) {
      throw new DomainError('GAME_NOT_FOUND', 'Juego no encontrado', 404);
    }
    return game;
  }

  async list(query: GameListQueryDto): Promise<GameListDto> {
    const { page, limit, search, genre, all } = query;
    const filters = { search, genre };
    if (all) {
      return this.repository.getAll(filters);
    }

    const { data, total } = await this.repository.getPaginated((page - 1) * limit, limit, filters);
    return { page, limit, total, data };
  }

  async patch(id: number, dto: GameUpdateDto): Promise<GameDto> {
    const game = await this.repository.patch(id, dto);
    if (!game) {
      throw new DomainError('GAME_NOT_FOUND', 'Juego no encontrado', 404);
    }
    return game;
  }

  async delete(id: number): Promise<void> {
    if (!(await this.repository.delete(id))) {
      throw new DomainError('GAME_NOT_FOUND', 'Juego no encontrado', 404);
    }
  }
}
