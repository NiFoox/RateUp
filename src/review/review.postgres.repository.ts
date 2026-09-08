import { Pool } from 'pg';
import { Review } from './review.entity.js';
import type { ReviewRepository } from './review.repository.interface.js';
import type { ReviewWithRelationsDto } from './dto/review-with-relations.dto.js';
import type { TrendingReviewDto } from './dto/trending-review.dto.js';

const mapRowToReview = (row: any): Review =>
  new Review(
    row.game_id,
    row.user_id,
    row.content,
    row.score,
    row.id,
    row.created_at,
    row.updated_at,
  );

export class ReviewPostgresRepository implements ReviewRepository {
  constructor(private readonly db: Pool) {}

  async create(review: Review): Promise<Review> {
    const { rows } = await this.db.query(
      `INSERT INTO reviews (game_id, user_id, content, score)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [review.gameId, review.userId, review.content, review.score],
    );
    return mapRowToReview(rows[0]);
  }

  async findById(id: number): Promise<Review | null> {
    const { rows } = await this.db.query(
      'SELECT * FROM reviews WHERE id = $1',
      [id],
    );
    return rows[0] ? mapRowToReview(rows[0]) : null;
  }

  async getPaginated(
    offset: number,
    limit: number,
    opts?: { gameId?: number; userId?: number },
  ): Promise<{ data: Review[]; total: number }> {
    const where: string[] = [];
    const values: any[] = [];

    if (opts?.gameId) {
      values.push(opts.gameId);
      where.push(`game_id = $${values.length}`);
    }

    if (opts?.userId) {
      values.push(opts.userId);
      where.push(`user_id = $${values.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*)::int AS count FROM reviews ${whereClause}`;
    const countResult = await this.db.query(countQuery, values);
    const total = Number(countResult.rows[0]?.count ?? 0);

    const dataQuery = `
      SELECT *
      FROM reviews
      ${whereClause}
      ORDER BY id
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;
    const dataParams = [...values, limit, offset];

    const { rows } = await this.db.query(dataQuery, dataParams);

    return {
      data: rows.map(mapRowToReview),
      total,
    };
  }

  async getPaginatedWithVotes(
    offset: number,
    limit: number,
    opts?: { gameId?: number; userId?: number; search?: string },
  ): Promise<{
    data: Array<{
      review: Review;
      votes: { upvotes: number; downvotes: number; score: number };
    }>;
    total: number;
  }> {
    const where: string[] = [];
    const values: any[] = [];

    if (opts?.gameId) {
      values.push(opts.gameId);
      where.push(`r.game_id = $${values.length}`);
    }

    if (opts?.userId) {
      values.push(opts.userId);
      where.push(`r.user_id = $${values.length}`);
    }

    if (opts?.search) {
      values.push(`%${opts.search}%`);
      const idx = values.length;
      where.push(`
        (
          r.content ILIKE $${idx}
          OR g.name ILIKE $${idx}
          OR u.username ILIKE $${idx}
        )
      `);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // 1) total de reviews (sin join con votos para no duplicar)
    const countQuery = `
      SELECT COUNT(*)::int AS count
      FROM reviews r
      JOIN games g ON g.id = r.game_id
      JOIN users u ON u.id = r.user_id
      ${whereClause}
    `;
    const countResult = await this.db.query(countQuery, values);
    const total = Number(countResult.rows[0]?.count ?? 0);

    // 2) datos con agregados de votos
    const dataQuery = `
      SELECT
        r.id,
        r.game_id,
        r.user_id,
        r.content,
        r.score,
        r.created_at,
        r.updated_at,
        COALESCE(COUNT(*) FILTER (WHERE rv.value = 1), 0)   AS votes_upvotes,
        COALESCE(COUNT(*) FILTER (WHERE rv.value = -1), 0)  AS votes_downvotes,
        COALESCE(SUM(rv.value), 0)                          AS votes_score
      FROM reviews r
      JOIN games g ON g.id = r.game_id
      JOIN users u ON u.id = r.user_id
      LEFT JOIN review_votes rv ON rv.review_id = r.id
      ${whereClause}
      GROUP BY
        r.id,
        r.game_id,
        r.user_id,
        r.content,
        r.score,
        r.created_at,
        r.updated_at
      ORDER BY r.id
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;

    const dataParams = [...values, limit, offset];
    const { rows } = await this.db.query(dataQuery, dataParams);

    const data = rows.map((row) => {
      const review = mapRowToReview(row);

      const votes = {
        upvotes: Number(row.votes_upvotes ?? 0),
        downvotes: Number(row.votes_downvotes ?? 0),
        score: Number(row.votes_score ?? 0),
      };

      return { review, votes };
    });

    return { data, total };
  }

  async findByIdWithRelations(id: number): Promise<ReviewWithRelationsDto | null> {
    const query = `
      SELECT
        r.id,
        r.content,
        r.score,
        r.created_at,
        r.updated_at,
        u.id   AS user_id,
        u.username AS user_username,
        u.email    AS user_email,
        g.id   AS game_id,
        g.name AS game_name,
        g.genre AS game_genre
      FROM reviews r
      JOIN users u ON u.id = r.user_id
      JOIN games g ON g.id = r.game_id
      WHERE r.id = $1
    `;

    const { rows } = await this.db.query(query, [id]);

    if (!rows[0]) {
      return null;
    }

    const row = rows[0];

    const dto: ReviewWithRelationsDto = {
      id: row.id,
      content: row.content,
      score: row.score,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      user: {
        id: row.user_id,
        username: row.user_username,
        email: row.user_email,
      },
      game: {
        id: row.game_id,
        name: row.game_name,
        genre: row.game_genre,
      },
    };

    return dto;
  }

  async getTrendingReviews(
    limit: number,
    daysWindow: number,
  ): Promise<TrendingReviewDto[]> {
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

    const { rows } = await this.db.query(query, [daysWindow, limit]);

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

  async update(id: number, data: Partial<Review>): Promise<Review | undefined> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.gameId !== undefined) {
      fields.push(`game_id = $${idx++}`);
      values.push(data.gameId);
    }
    if (data.userId !== undefined) {
      fields.push(`user_id = $${idx++}`);
      values.push(data.userId);
    }
    if (data.content !== undefined) {
      fields.push(`content = $${idx++}`);
      values.push(data.content);
    }
    if (data.score !== undefined) {
      fields.push(`score = $${idx++}`);
      values.push(data.score);
    }

    if (!fields.length) {
      const existing = await this.findById(id);
      return existing ?? undefined;
    }

    // updated_at siempre cambia cuando se hace PATCH
    fields.push(`updated_at = NOW()`);

    values.push(id);
    const { rows } = await this.db.query(
      `UPDATE reviews
       SET ${fields.join(', ')}
       WHERE id = $${idx}
       RETURNING *`,
      values,
    );

    return rows[0] ? mapRowToReview(rows[0]) : undefined;
  }

  async delete(id: number): Promise<boolean> {
    const { rowCount } = await this.db.query(
      'DELETE FROM reviews WHERE id = $1',
      [id],
    );
    return (rowCount ?? 0) > 0;
  }
}
