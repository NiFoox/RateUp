import type { Pool } from 'pg';
import { User, type UserRole } from './user.entity.js';
import { mapPostgresErrorToDomainError } from '../shared/errors/db-errors.js';
import type {
  UserRepository,
  UserProfileStats,
  UserUpdateData,
} from './user.repository.interface.js';

interface UserRow {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  roles: UserRole[];
  is_active: boolean;
  created_at: Date;
  avatar_url: string | null;
  bio: string | null;
}

interface UserProfileStatsRow {
  reviews_count: number;
  upvotes: number;
  downvotes: number;
}

function mapRowToUser(row: UserRow): User {
  return new User(
    row.username,
    row.email,
    row.password_hash,
    row.roles,
    row.is_active,
    row.created_at,
    row.avatar_url ?? null,
    row.bio ?? null,
    row.id,
  );
}

export class UserPostgresRepository implements UserRepository {
  constructor(private readonly db: Pool) {}

  async create(user: User): Promise<User> {
    const query = `
      INSERT INTO users (username, email, password_hash, roles, is_active, avatar_url, bio)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [
      user.username,
      user.email,
      user.passwordHash,
      user.roles,
      user.isActive,
      user.avatarUrl,
      user.bio,
    ];

    try {
      const { rows } = await this.db.query<UserRow>(query, values);
      return mapRowToUser(rows[0]);
    } catch (error) {
      throw mapPostgresErrorToDomainError(error) ?? error;
    }
  }

  async findById(id: number): Promise<User | null> {
    const { rows } = await this.db.query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] ? mapRowToUser(rows[0]) : null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const { rows } = await this.db.query<UserRow>(
      'SELECT * FROM users WHERE username = $1',
      [username],
    );
    return rows[0] ? mapRowToUser(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const { rows } = await this.db.query<UserRow>(
      'SELECT * FROM users WHERE email = $1',
      [email],
    );
    return rows[0] ? mapRowToUser(rows[0]) : null;
  }

  async search(
    page: number,
    pageSize: number,
    searchTerm?: string,
  ): Promise<{ data: User[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const params: string[] = [];
    let whereClause = '';

    if (searchTerm) {
      params.push(`%${searchTerm.toLowerCase()}%`);
      whereClause =
        'WHERE LOWER(username) LIKE $1 OR LOWER(email) LIKE $1';
    }

    const totalQuery = `SELECT COUNT(*)::int AS count FROM users ${whereClause}`;
    const totalResult = await this.db.query<{ count: number }>(totalQuery, params);
    const total = Number(totalResult.rows[0]?.count ?? 0);

    const dataQuery = `
      SELECT *
      FROM users
      ${whereClause}
      ORDER BY id
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;

    const dataParams = [...params, pageSize, offset];
    const { rows } = await this.db.query<UserRow>(dataQuery, dataParams);

    return {
      data: rows.map(mapRowToUser),
      total,
    };
  }

  async update(id: number, data: UserUpdateData): Promise<User | undefined> {
    const fields: string[] = [];
    const values: (string | number | boolean | UserRole[] | null)[] = [];
    let index = 1;

    if (data.username !== undefined) {
      fields.push(`username = $${index++}`);
      values.push(data.username);
    }
    if (data.email !== undefined) {
      fields.push(`email = $${index++}`);
      values.push(data.email);
    }
    if (data.passwordHash !== undefined) {
      fields.push(`password_hash = $${index++}`);
      values.push(data.passwordHash);
    }
    if (data.roles !== undefined) {
      fields.push(`roles = $${index++}`);
      values.push(data.roles);
    }
    if (data.isActive !== undefined) {
      fields.push(`is_active = $${index++}`);
      values.push(data.isActive);
    }
    if (data.avatarUrl !== undefined) {
      fields.push(`avatar_url = $${index++}`);
      values.push(data.avatarUrl);
    }
    if (data.bio !== undefined) {
      fields.push(`bio = $${index++}`);
      values.push(data.bio);
    }

    if (fields.length === 0) {
      const existing = await this.findById(id);
      return existing ?? undefined;
    }

    values.push(id);

    const query = `
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = $${values.length}
      RETURNING *
    `;

    try {
      const { rows } = await this.db.query<UserRow>(query, values);
      const row = rows[0];
      return row ? mapRowToUser(row) : undefined;
    } catch (error) {
      throw mapPostgresErrorToDomainError(error) ?? error;
    }
  }

  async delete(id: number): Promise<boolean> {
    const { rowCount } = await this.db.query(
      'DELETE FROM users WHERE id = $1',
      [id],
    );
    return (rowCount ?? 0) > 0;
  }

  // Stats para el perfil
  async getProfileStats(userId: number): Promise<UserProfileStats> {
    const query = `
      SELECT
        COUNT(DISTINCT r.id)::int AS reviews_count,
        COALESCE(SUM(CASE WHEN rv.value = 1 THEN 1 ELSE 0 END), 0)::int AS upvotes,
        COALESCE(SUM(CASE WHEN rv.value = -1 THEN 1 ELSE 0 END), 0)::int AS downvotes
      FROM users u
      LEFT JOIN reviews r ON r.user_id = u.id
      LEFT JOIN review_votes rv ON rv.review_id = r.id
      WHERE u.id = $1
    `;

    const { rows } = await this.db.query<UserProfileStatsRow>(query, [userId]);
    const row = rows[0] ?? {
      reviews_count: 0,
      upvotes: 0,
      downvotes: 0,
    };

    return {
      reviewsCount: Number(row.reviews_count ?? 0),
      upvotes: Number(row.upvotes ?? 0),
      downvotes: Number(row.downvotes ?? 0),
    };
  }
}
