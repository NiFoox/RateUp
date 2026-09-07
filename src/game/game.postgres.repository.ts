import type { Pool } from 'pg';
import type { Game, StoredGame } from './game.entity.js';
import type { GameChanges, GameFilters, GameRepository } from './game.repository.interface.js';
import type { TopGameDTO } from './dto/top-game.dto.js';
import { mapPostgresErrorToDomainError } from '../shared/errors/db-errors.js';

function buildFilters({ search, genre }: GameFilters = {}) {
  const conditions: string[] = [];
  const values: string[] = [];

  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(name ILIKE $${values.length} OR description ILIKE $${values.length})`);
  }
  if (genre) {
    values.push(genre);
    conditions.push(`genre = $${values.length}`);
  }

  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', values };
}

export class GamePostgresRepository implements GameRepository {
  constructor(private readonly db: Pool) {}

  async create(game: Game): Promise<StoredGame> {
    try {
      const { rows } = await this.db.query<StoredGame>(
        `INSERT INTO games (name, description, genre) VALUES ($1, $2, $3)
         RETURNING id, name, description, genre`,
        [game.name, game.description, game.genre],
      );
      return rows[0];
    } catch (error) {
      throw mapPostgresErrorToDomainError(error) ?? error;
    }
  }

  async findById(id: number): Promise<StoredGame | null> {
    const { rows } = await this.db.query<StoredGame>(
      'SELECT id, name, description, genre FROM games WHERE id = $1',
      [id],
    );
    return rows[0] ?? null;
  }

  async findByName(name: string): Promise<StoredGame | null> {
    const { rows } = await this.db.query<StoredGame>(
      'SELECT id, name, description, genre FROM games WHERE name = $1',
      [name],
    );
    return rows[0] ?? null;
  }

  async getPaginated(
    offset: number,
    limit: number,
    filters?: GameFilters,
  ): Promise<{ data: StoredGame[]; total: number }> {
    const { where, values } = buildFilters(filters);
    const countResult = await this.db.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM games ${where}`,
      values,
    );
    const { rows } = await this.db.query<StoredGame>(
      `SELECT id, name, description, genre FROM games ${where}
       ORDER BY id LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    );
    return { data: rows, total: countResult.rows[0]?.count ?? 0 };
  }

  async getAll(filters?: GameFilters): Promise<StoredGame[]> {
    const { where, values } = buildFilters(filters);
    const { rows } = await this.db.query<StoredGame>(
      `SELECT id, name, description, genre FROM games ${where} ORDER BY id`,
      values,
    );
    return rows;
  }

  async getTopRatedGames(limit: number, minReviews: number = 1): Promise<TopGameDTO[]> {
    const { rows } = await this.db.query<{
      id: number;
      name: string;
      genre: string;
      review_count: string;
      avg_score: string;
    }>(
      `SELECT g.id, g.name, g.genre,
              COUNT(r.id) AS review_count,
              COALESCE(AVG(r.score), 0) AS avg_score
       FROM games g
       LEFT JOIN reviews r ON r.game_id = g.id
       GROUP BY g.id, g.name, g.genre
       HAVING COUNT(r.id) >= $1
       ORDER BY avg_score DESC, review_count DESC, g.name ASC
       LIMIT $2`,
      [minReviews, limit],
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      genre: row.genre,
      avgScore: Number(row.avg_score),
      reviewCount: Number(row.review_count),
    }));
  }

  async patch(id: number, changes: GameChanges): Promise<StoredGame | null> {
    const fields: Array<keyof GameChanges> = ['name', 'description', 'genre'];
    const setters: string[] = [];
    const values: unknown[] = [];

    for (const field of fields) {
      if (changes[field] !== undefined) {
        values.push(changes[field]);
        setters.push(`${field} = $${values.length}`);
      }
    }
    if (!setters.length) {
      return this.findById(id);
    }

    values.push(id);
    try {
      const { rows } = await this.db.query<StoredGame>(
        `UPDATE games SET ${setters.join(', ')} WHERE id = $${values.length}
         RETURNING id, name, description, genre`,
        values,
      );
      return rows[0] ?? null;
    } catch (error) {
      throw mapPostgresErrorToDomainError(error) ?? error;
    }
  }

  async delete(id: number): Promise<boolean> {
    const { rowCount } = await this.db.query('DELETE FROM games WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  }
}
