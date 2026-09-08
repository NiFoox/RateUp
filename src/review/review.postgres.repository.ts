import type { Pool } from 'pg';
import type { Review } from './review.entity.js';
import { DomainError } from '../shared/errors/domain-error.js';
import type { ReviewRepository, ReviewFilters } from './review.repository.interface.js';
import type { ReviewDto, ReviewListItemDto, ReviewVoteValue } from './dto/review.dto.js';
import type { ReviewUpdateDto } from './dto/update-review.dto.js';
import type { ReviewWithRelationsDto } from './dto/review-with-relations.dto.js';
import type { TrendingReviewDto } from './dto/trending-review.dto.js';

interface ReviewRow {
  id: number;
  game_id: number;
  user_id: number;
  content: string;
  score: number;
  created_at: Date;
  updated_at: Date | null;
}
interface ReviewRelationsRow extends ReviewRow {
  user_username: string;
  game_name: string;
  game_genre: string;
}
interface TrendingReviewRow extends Omit<ReviewRelationsRow, 'updated_at'> {
  vote_score: string | number;
}
interface ReviewVotesRow {
  review_id: number;
  upvotes: number;
  downvotes: number;
  score: number;
  user_vote: ReviewVoteValue;
}

const mapRowToReview = (row: ReviewRow): ReviewDto => ({
  id: row.id,
  gameId: row.game_id,
  userId: row.user_id,
  content: row.content,
  score: row.score,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
const mapRelations = (row: ReviewRelationsRow): ReviewWithRelationsDto => ({
  id: row.id,
  content: row.content,
  score: row.score,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  user: { id: row.user_id, username: row.user_username },
  game: { id: row.game_id, name: row.game_name, genre: row.game_genre },
});

function mapWriteError(error: unknown): unknown {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23503' &&
    'constraint' in error
  ) {
    if (error.constraint === 'reviews_game_id_fkey') {
      return new DomainError('GAME_NOT_FOUND', 'Juego no encontrado', 404, 'gameId');
    }
    if (error.constraint === 'reviews_user_id_fkey') {
      return new DomainError('USER_NOT_FOUND', 'Usuario no encontrado', 404, 'userId');
    }
  }
  return error;
}

export class ReviewPostgresRepository implements ReviewRepository {
  constructor(private readonly db: Pool) {}

  async create(review: Review): Promise<ReviewDto> {
    try {
      const { rows } = await this.db.query<ReviewRow>(
        `INSERT INTO reviews (game_id, user_id, content, score)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [review.gameId, review.userId, review.content, review.score],
      );
      return mapRowToReview(rows[0]);
    } catch (error) {
      throw mapWriteError(error);
    }
  }

  async findById(id: number): Promise<ReviewDto | null> {
    const { rows } = await this.db.query<ReviewRow>('SELECT * FROM reviews WHERE id = $1', [id]);
    return rows[0] ? mapRowToReview(rows[0]) : null;
  }

  async getListPage(
    offset: number,
    limit: number,
    filters: ReviewFilters,
    currentUserId: number | null,
  ): Promise<{ data: ReviewListItemDto[]; total: number }> {
    const where: string[] = [];
    const values: (number | string)[] = [];
    if (filters.gameId !== undefined) {
      values.push(filters.gameId);
      where.push(`r.game_id = $${values.length}`);
    }
    if (filters.userId !== undefined) {
      values.push(filters.userId);
      where.push(`r.user_id = $${values.length}`);
    }
    if (filters.search) {
      values.push(`%${filters.search}%`);
      where.push(
        `(r.content ILIKE $${values.length} OR g.name ILIKE $${values.length} OR u.username ILIKE $${values.length})`,
      );
    }
    const from = `FROM reviews r JOIN games g ON g.id = r.game_id JOIN users u ON u.id = r.user_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`;
    const count = await this.db.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count ${from}`,
      values,
    );
    const { rows } = await this.db.query<ReviewRelationsRow>(
      `SELECT r.*, u.username AS user_username, g.name AS game_name, g.genre AS game_genre
       ${from} ORDER BY r.id LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    );
    const total = count.rows[0].count;
    if (rows.length === 0) return { data: [], total };

    // Dos agregados por página, no consultas por cada reseña. Separar comentarios
    // y votos evita multiplicar filas y contadores al combinarlos en un JOIN.
    const ids = rows.map((row) => row.id);
    const [comments, votes] = await Promise.all([
      this.db.query<{ review_id: number; count: number }>(
        `SELECT review_id, COUNT(*)::int AS count FROM review_comments
         WHERE review_id = ANY($1::int[]) GROUP BY review_id`,
        [ids],
      ),
      this.db.query<ReviewVotesRow>(
        `SELECT review_id,
           COUNT(*) FILTER (WHERE value = 1)::int AS upvotes,
           COUNT(*) FILTER (WHERE value = -1)::int AS downvotes,
           COALESCE(SUM(value), 0)::int AS score,
           COALESCE(MAX(value) FILTER (WHERE user_id = $2::int), 0)::int AS user_vote
         FROM review_votes WHERE review_id = ANY($1::int[]) GROUP BY review_id`,
        [ids, currentUserId],
      ),
    ]);
    const commentsById = new Map(comments.rows.map((row) => [row.review_id, row.count]));
    const votesById = new Map(votes.rows.map((row) => [row.review_id, row]));
    const data = rows.map((row): ReviewListItemDto => {
      const { user, game } = mapRelations(row);
      const summary = votesById.get(row.id);
      return {
        ...mapRowToReview(row),
        user,
        game,
        comments: commentsById.get(row.id) ?? 0,
        votes: {
          reviewId: row.id,
          upvotes: summary?.upvotes ?? 0,
          downvotes: summary?.downvotes ?? 0,
          score: summary?.score ?? 0,
        },
        userVote: summary?.user_vote ?? 0,
      };
    });
    return { data, total };
  }

  async findByIdWithRelations(id: number): Promise<ReviewWithRelationsDto | null> {
    const { rows } = await this.db.query<ReviewRelationsRow>(
      `SELECT r.*, u.username AS user_username, g.name AS game_name, g.genre AS game_genre
       FROM reviews r JOIN users u ON u.id = r.user_id JOIN games g ON g.id = r.game_id
       WHERE r.id = $1`,
      [id],
    );
    return rows[0] ? mapRelations(rows[0]) : null;
  }
  async getTrendingReviews(limit: number, daysWindow: number): Promise<TrendingReviewDto[]> {
    const query = `
      SELECT
        r.id,
        r.content,
        r.score,
        r.created_at,
        u.id   AS user_id,
        u.username AS user_username,
        g.id   AS game_id,
        g.name AS game_name,
        g.genre AS game_genre,
        COALESCE(SUM(rv.value), 0) AS vote_score
      FROM reviews r
      JOIN users u ON u.id = r.user_id
      JOIN games g ON g.id = r.game_id
      LEFT JOIN review_votes rv
        ON rv.review_id = r.id
       AND rv.created_at >= NOW() - ($1 || ' days')::INTERVAL
      WHERE r.created_at >= NOW() - ($1 || ' days')::INTERVAL
      GROUP BY
        r.id,
        r.content,
        r.score,
        r.created_at,
        u.id,
        u.username,
        g.id,
        g.name,
        g.genre
      ORDER BY
        vote_score DESC,
        r.created_at DESC
      LIMIT $2
    `;

    const { rows } = await this.db.query<TrendingReviewRow>(query, [daysWindow, limit]);

    return rows.map((row) => ({
      id: row.id,
      content: row.content,
      score: row.score,
      createdAt: row.created_at,
      voteScore: Number(row.vote_score),
      user: {
        id: row.user_id,
        username: row.user_username,
      },
      game: {
        id: row.game_id,
        name: row.game_name,
        genre: row.game_genre,
      },
    }));
  }

  async update(id: number, data: ReviewUpdateDto): Promise<ReviewDto | undefined> {
    const fields: string[] = [];
    const values: (number | string)[] = [];
    if (data.gameId !== undefined) {
      values.push(data.gameId);
      fields.push(`game_id = $${values.length}`);
    }
    if (data.content !== undefined) {
      values.push(data.content);
      fields.push(`content = $${values.length}`);
    }
    if (data.score !== undefined) {
      values.push(data.score);
      fields.push(`score = $${values.length}`);
    }
    if (!fields.length) return (await this.findById(id)) ?? undefined;
    fields.push('updated_at = NOW()');
    values.push(id);
    try {
      const { rows } = await this.db.query<ReviewRow>(
        `UPDATE reviews SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
        values,
      );
      return rows[0] ? mapRowToReview(rows[0]) : undefined;
    } catch (error) {
      throw mapWriteError(error);
    }
  }

  async delete(id: number): Promise<boolean> {
    const { rowCount } = await this.db.query('DELETE FROM reviews WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  }
}
