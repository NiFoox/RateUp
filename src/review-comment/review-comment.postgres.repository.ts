import { Pool } from 'pg';
import { ReviewComment } from './review-comment.entity.js';
import type { ReviewCommentRepository } from './review-comment.repository.interface.js';
import type { ReviewCommentWithUserDto } from './dto/review-comment-with-user.dto.js';

const mapRowToComment = (row: any): ReviewComment =>
  new ReviewComment(
    row.review_id,
    row.user_id,
    row.content,
    row.id,
    row.created_at,
    row.updated_at,
  );

export class ReviewCommentPostgresRepository implements ReviewCommentRepository {
  constructor(private readonly db: Pool) {}

  async create(comment: ReviewComment): Promise<ReviewComment> {
    const { rows } = await this.db.query(
      `INSERT INTO review_comments (review_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [comment.reviewId, comment.userId, comment.content],
    );
    return mapRowToComment(rows[0]);
  }

  async findById(id: number): Promise<ReviewComment | null> {
    const { rows } = await this.db.query(
      'SELECT * FROM review_comments WHERE id = $1',
      [id],
    );
    return rows[0] ? mapRowToComment(rows[0]) : null;
  }

  async getByReview(
    reviewId: number,
    offset: number,
    limit: number,
  ): Promise<ReviewComment[]> {
    const { rows } = await this.db.query(
      `SELECT *
       FROM review_comments
       WHERE review_id = $1
       ORDER BY created_at ASC, id ASC
       LIMIT $2 OFFSET $3`,
      [reviewId, limit, offset],
    );
    return rows.map(mapRowToComment);
  }

  async getByReviewWithUser(
    reviewId: number,
    offset: number,
    limit: number,
  ): Promise<ReviewCommentWithUserDto[]> {
    const query = `
      SELECT
        c.id,
        c.review_id,
        c.content,
        c.created_at,
        c.updated_at,
        u.id        AS user_id,
        u.username  AS user_username
      FROM review_comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.review_id = $1
      ORDER BY c.created_at ASC
      OFFSET $2
      LIMIT $3
    `;

    const { rows } = await this.db.query(query, [reviewId, offset, limit]);

    return rows.map((row) => ({
      id: row.id,
      reviewId: row.review_id,
      content: row.content,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      user: {
        id: row.user_id,
        username: row.user_username,
      },
    }));
  }

  async countByReview(reviewId: number): Promise<number> {
    const { rows } = await this.db.query(
      'SELECT COUNT(*)::int AS count FROM review_comments WHERE review_id = $1',
      [reviewId],
    );

    return Number(rows[0]?.count ?? 0);
  }

  async update(
    id: number,
    data: Partial<Pick<ReviewComment, 'content'>>,
  ): Promise<ReviewComment | undefined> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.content !== undefined) {
      fields.push(`content = $${idx++}`);
      values.push(data.content);
    }

    if (!fields.length) {
      // nada para actualizar → devolver comment actual (si existe)
      const existing = await this.findById(id);
      return existing ?? undefined;
    }

    // updated_at siempre cambia cuando se hace PATCH
    fields.push(`updated_at = NOW()`);

    values.push(id);

    const { rows } = await this.db.query(
      `UPDATE review_comments
       SET ${fields.join(', ')}
       WHERE id = $${idx}
       RETURNING *`,
      values,
    );

    return rows[0] ? mapRowToComment(rows[0]) : undefined;
  }

  async delete(id: number, reviewId?: number): Promise<boolean> {
    const values: any[] = [id];
    let where = 'id = $1';

    if (reviewId !== undefined) {
      values.push(reviewId);
      where += ` AND review_id = $2`;
    }

    const { rowCount } = await this.db.query(
      `DELETE FROM review_comments WHERE ${where}`,
      values,
    );

    return (rowCount ?? 0) > 0;
  }
}
