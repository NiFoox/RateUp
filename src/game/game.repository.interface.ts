import type { Game, StoredGame } from './game.entity.js';
import type { TopGameDto } from './dto/top-game.dto.js';

export interface GameFilters {
  search?: string;
  genre?: string;
}

export type GameChanges = Partial<Pick<Game, 'name' | 'description' | 'genre'>>;

export interface GameRepository {
  create(game: Game): Promise<StoredGame>;
  findById(id: number): Promise<StoredGame | null>;
  findByName(name: string): Promise<StoredGame | null>;
  getPaginated(
    offset: number,
    limit: number,
    filters?: GameFilters,
  ): Promise<{ data: StoredGame[]; total: number }>;
  getAll(filters?: GameFilters): Promise<StoredGame[]>;
  getTopRatedGames(limit: number, minReviews?: number): Promise<TopGameDto[]>;
  patch(id: number, changes: GameChanges): Promise<StoredGame | null>;
  delete(id: number): Promise<boolean>;
}
