import { User, type UserRole } from './user.entity.js';
import type {
  UserRepository,
  UserProfileStats,
} from './user.repository.interface.js';
import type {
  UserCreateDto,
  UserUpdateDto,
  UserListQueryDto,
} from './validators/user.validation.js';
import { hashPassword } from '../common/password.util.js';

export interface UserDto {
  id: number;
  username: string;
  email: string;
  roles: UserRole[];
  isActive: boolean;
  createdAt: string;
  avatarUrl: string | null;
  bio: string | null;
}

export interface UserProfileReputation {
  upvotes: number;
  downvotes: number;
  score: number;
  likesRate: number;
}

export interface PublicUserProfileDto {
  id: number;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
  stats: {
    reviewsCount: number;
    reputation: UserProfileReputation;
  };
}

export interface PrivateUserProfileDto extends PublicUserProfileDto {
  email: string;
  roles: UserRole[];
}

export class UserService {
  constructor(private readonly repository: UserRepository) {}

  // ---------- mapeos internos ----------

  private toDto(user: User): UserDto {
    return {
      id: user.id!,
      username: user.username,
      email: user.email,
      roles: user.roles,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      avatarUrl: user.avatarUrl ?? null,
      bio: user.bio ?? null,
    };
  }

  private buildReputation(stats: UserProfileStats): UserProfileReputation {
    const up = stats.upvotes ?? 0;
    const down = stats.downvotes ?? 0;
    const totalVotes = up + down;
    const score = up - down;
    const likesRate = totalVotes > 0 ? up / totalVotes : 0;

    return {
      upvotes: up,
      downvotes: down,
      score,
      likesRate,
    };
  }

  // ---------- CRUD básico ----------

  async create(dto: UserCreateDto): Promise<UserDto> {
    const existingByUsername = await this.repository.findByUsername(
      dto.username,
    );
    if (existingByUsername) {
      throw new Error('USER_ALREADY_EXISTS');
    }

    const existingByEmail = await this.repository.findByEmail(dto.email);
    if (existingByEmail) {
      throw new Error('USER_ALREADY_EXISTS');
    }

    const passwordHash = await hashPassword(dto.password);

    const user = new User(
      dto.username,
      dto.email,
      passwordHash,
      dto.roles ?? ['USER'],
      dto.isActive ?? true,
    );

    const created = await this.repository.create(user);
    return this.toDto(created);
  }

  async list(query: UserListQueryDto): Promise<{
    page: number;
    pageSize: number;
    total: number;
    data: UserDto[];
  }> {
    const { page, pageSize, search } = query;
    const { data, total } = await this.repository.search(
      page,
      pageSize,
      search,
    );

    return {
      page,
      pageSize,
      total,
      data: data.map((u) => this.toDto(u)),
    };
  }

  async findById(id: number): Promise<UserDto | null> {
    const user = await this.repository.findById(id);
    return user ? this.toDto(user) : null;
  }

  async update(id: number, dto: UserUpdateDto): Promise<UserDto | null> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      return null;
    }

    const payload: Partial<User> = {};

    if (dto.username !== undefined) {
      payload.username = dto.username;
    }
    if (dto.email !== undefined) {
      payload.email = dto.email;
    }
    if (dto.password !== undefined) {
      payload.passwordHash = await hashPassword(dto.password);
    }
    if (dto.isActive !== undefined) {
      payload.isActive = dto.isActive;
    }
    if (dto.avatarUrl !== undefined) {
      payload.avatarUrl = dto.avatarUrl;
    }
    if (dto.bio !== undefined) {
      payload.bio = dto.bio;
    }

    const updated = await this.repository.update(id, payload);
    return updated ? this.toDto(updated) : null;
  }

  async updateRoles(id: number, roles: UserRole[]): Promise<UserDto | null> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      return null;
    }

    const updated = await this.repository.update(id, { roles });
    return updated ? this.toDto(updated) : null;
  }

  async delete(id: number): Promise<boolean> {
    return this.repository.delete(id);
  }

  // ---------- Perfiles ----------

  async getPublicProfile(id: number): Promise<PublicUserProfileDto | null> {
    const user = await this.repository.findById(id);
    if (!user || !user.isActive) {
      return null;
    }

    const statsRaw = await this.repository.getProfileStats(id);
    const reputation = this.buildReputation(statsRaw);

    return {
      id: user.id!,
      username: user.username,
      avatarUrl: user.avatarUrl ?? null,
      bio: user.bio ?? null,
      createdAt: user.createdAt.toISOString(),
      stats: {
        reviewsCount: statsRaw.reviewsCount,
        reputation,
      },
    };
  }

  async getPrivateProfile(id: number): Promise<PrivateUserProfileDto | null> {
    const user = await this.repository.findById(id);
    if (!user) {
      return null;
    }

    const statsRaw = await this.repository.getProfileStats(id);
    const reputation = this.buildReputation(statsRaw);

    return {
      id: user.id!,
      username: user.username,
      email: user.email,
      roles: user.roles,
      avatarUrl: user.avatarUrl ?? null,
      bio: user.bio ?? null,
      createdAt: user.createdAt.toISOString(),
      stats: {
        reviewsCount: statsRaw.reviewsCount,
        reputation,
      },
    };
  }
}
