import { Pool } from 'pg';
import { ReviewComment } from './review-comment.entity.js';
import type { ReviewCommentRepository } from './review-comment.repository.interface.js';
import type { ReviewCommentWithUserDto } from './dto/review-comment-with-user.dto.js';

import type { ReviewCommentDto } from './dto/review-comment.dto.js';
import type { ReviewCommentUpdateDto } from './dto/update-comment.dto.js';
import { mapPostgresErrorToDomainError } from '../shared/errors/db-errors.js';

interface CommentRow {
  id: number;
  review_id: number;
  user_id: number;
  content: string;
  created_at: Date;
  updated_at: Date | null;
}
interface CommentWithUserRow extends CommentRow {
  user_username: string;
}

const mapRowToComment = (row: CommentRow): ReviewCommentDto => ({
  id: row.id,
  reviewId: row.review_id,
  userId: row.user_id,
  content: row.content,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class ReviewCommentPostgresRepository implements ReviewCommentRepository {
  constructor(private readonly db: Pool) {}

  async create(comment: ReviewComment): Promise<ReviewCommentDto> {
    try {
      const { rows } = await this.db.query<CommentRow>(
        `INSERT INTO review_comments (review_id, user_id, content)
         VALUES ($1, $2, $3) RETURNING *`,
        [comment.reviewId, comment.userId, comment.content],
      );
      return mapRowToComment(rows[0]);
    } catch (error: unknown) {
      throw mapPostgresErrorToDomainError(error) ?? error;
    }
  }

  async findById(id: number): Promise<ReviewCommentDto | null> {
    const { rows } = await this.db.query<CommentRow>(
      'SELECT * FROM review_comments WHERE id = $1',
      [id],
    );
    return rows[0] ? mapRowToComment(rows[0]) : null;
  }

  async getByReview(reviewId: number, offset: number, limit: number): Promise<ReviewCommentDto[]> {
    const { rows } = await this.db.query<CommentRow>(
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
      ORDER BY c.created_at ASC, c.id ASC
      OFFSET $2
      LIMIT $3
    `;

    const { rows } = await this.db.query<CommentWithUserRow>(query, [reviewId, offset, limit]);

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
    const { rows } = await this.db.query<{ count: number }>(
      'SELECT COUNT(*)::int AS count FROM review_comments WHERE review_id = $1',
      [reviewId],
    );

    return Number(rows[0]?.count ?? 0);
  }

  async update(id: number, data: ReviewCommentUpdateDto): Promise<ReviewCommentDto | undefined> {
    if (data.content === undefined) {
      return (await this.findById(id)) ?? undefined;
    }
    const { rows } = await this.db.query<CommentRow>(
      `UPDATE review_comments SET content = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [data.content, id],
    );

    return rows[0] ? mapRowToComment(rows[0]) : undefined;
  }

  async delete(id: number, reviewId: number): Promise<boolean> {
    const { rowCount } = await this.db.query(
      'DELETE FROM review_comments WHERE id = $1 AND review_id = $2',
      [id, reviewId],
    );
    return (rowCount ?? 0) > 0;
  }
}
