import { Pool } from 'pg';
import { ReviewVote } from './review-vote.entity.js';
import type { ReviewVoteRepository } from './review-vote.repository.interface.js';

import { mapPostgresErrorToDomainError } from '../shared/errors/db-errors.js';
import type { ReviewVoteSummaryDto } from './dto/review-vote.dto.js';

interface VoteRow {
  id: number;
  review_id: number;
  user_id: number;
  value: 1 | -1;
  created_at: Date;
  updated_at: Date | null;
}

const mapRowToVote = (row: VoteRow): ReviewVote =>
  new ReviewVote(row.review_id, row.user_id, row.value, row.id, row.created_at, row.updated_at);

export class ReviewVotePostgresRepository implements ReviewVoteRepository {
  constructor(private readonly db: Pool) {}

  async upsertVote(reviewId: number, userId: number, value: 1 | -1): Promise<ReviewVote> {
    try {
      const { rows } = await this.db.query<VoteRow>(
        `
        INSERT INTO review_votes (review_id, user_id, value)
        VALUES ($1, $2, $3)
        ON CONFLICT (review_id, user_id)
        DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        RETURNING *
        `,
        [reviewId, userId, value],
      );

      return mapRowToVote(rows[0]);
    } catch (error: unknown) {
      throw mapPostgresErrorToDomainError(error) ?? error;
    }
  }

  async deleteVote(reviewId: number, userId: number): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `
      DELETE FROM review_votes
      WHERE review_id = $1 AND user_id = $2
      `,
      [reviewId, userId],
    );

    return (rowCount ?? 0) > 0;
  }

  async getSummary(reviewId: number): Promise<ReviewVoteSummaryDto> {
    const { rows } = await this.db.query<{ upvotes: string; downvotes: string; score: string }>(
      `
      SELECT
        COUNT(*) FILTER (WHERE value = 1)  AS upvotes,
        COUNT(*) FILTER (WHERE value = -1) AS downvotes,
        COALESCE(SUM(value), 0)            AS score
      FROM review_votes
      WHERE review_id = $1
      `,
      [reviewId],
    );

    const row = rows[0] ?? { upvotes: 0, downvotes: 0, score: 0 };

    return {
      upvotes: Number(row.upvotes ?? 0),
      downvotes: Number(row.downvotes ?? 0),
      score: Number(row.score ?? 0),
    };
  }

  async getUserVote(reviewId: number, userId: number): Promise<-1 | 0 | 1> {
    const { rows } = await this.db.query<Pick<VoteRow, 'value'>>(
      `
      SELECT value
      FROM review_votes
      WHERE review_id = $1 AND user_id = $2
      LIMIT 1
      `,
      [reviewId, userId],
    );

    const row = rows[0];

    if (!row || row.value == null) {
      return 0;
    }

    const value = Number(row.value);
    if (value === 1) return 1;
    if (value === -1) return -1;
    return 0;
  }
}
