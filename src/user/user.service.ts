import { User, type UserRole } from './user.entity.js';
import type { UserRepository, UserUpdateData } from './user.repository.interface.js';
import type { UserCreateDto } from './dto/create-user.dto.js';
import type { UserAdminUpdateDto } from './dto/update-user.dto.js';
import type { UserListQueryDto } from './dto/list-users.dto.js';
import type {
  UserDto,
  UserListDto,
  PublicUserProfileDto,
  PrivateUserProfileDto,
} from './dto/user.dto.js';
import { hashPassword } from '../common/password.util.js';
import { DomainError } from '../shared/errors/domain-error.js';

export class UserService {
  constructor(private readonly repository: UserRepository) {}

  private toDto(user: User): UserDto {
    return {
      id: user.id!,
      username: user.username,
      email: user.email,
      roles: user.roles,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      avatarUrl: user.avatarUrl,
      bio: user.bio,
    };
  }

  private async toPublicProfile(user: User): Promise<PublicUserProfileDto> {
    const { reviewsCount, upvotes, downvotes } = await this.repository.getProfileStats(user.id!);
    const totalVotes = upvotes + downvotes;
    return {
      id: user.id!,
      username: user.username,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      createdAt: user.createdAt.toISOString(),
      stats: {
        reviewsCount,
        reputation: {
          upvotes,
          downvotes,
          score: upvotes - downvotes,
          likesRate: totalVotes > 0 ? upvotes / totalVotes : 0,
        },
      },
    };
  }

  private async requireUser(id: number): Promise<User> {
    const user = await this.repository.findById(id);
    if (!user) throw new DomainError('USER_NOT_FOUND', 'Usuario no encontrado', 404);
    return user;
  }

  async create(dto: UserCreateDto): Promise<UserDto> {
    const passwordHash = await hashPassword(dto.password);
    const user = new User(dto.username, dto.email, passwordHash, dto.roles, dto.isActive);
    // PostgreSQL garantiza unicidad incluso ante creaciones concurrentes.
    return this.toDto(await this.repository.create(user));
  }

  async list(query: UserListQueryDto): Promise<UserListDto> {
    const { page, pageSize, search } = query;
    const { data, total } = await this.repository.search(page, pageSize, search);
    return { page, pageSize, total, data: data.map((user) => this.toDto(user)) };
  }

  async findById(id: number): Promise<UserDto> {
    return this.toDto(await this.requireUser(id));
  }

  async update(
    id: number,
    dto: UserAdminUpdateDto,
    actor: { id: number; roles: UserRole[] },
  ): Promise<UserDto> {
    const isAdmin = actor.roles.includes('ADMIN');
    if (actor.id !== id && !isAdmin) {
      throw new DomainError('FORBIDDEN', 'No estás autorizado para modificar este usuario', 403);
    }
    if (!isAdmin && dto.isActive !== undefined) {
      throw new DomainError('FORBIDDEN', 'No estás autorizado para modificar el estado del usuario', 403);
    }

    const payload: UserUpdateData = {
      username: dto.username,
      email: dto.email,
      avatarUrl: dto.avatarUrl,
      bio: dto.bio,
      isActive: dto.isActive,
    };
    if (dto.password !== undefined) payload.passwordHash = await hashPassword(dto.password);

    const updated = await this.repository.update(id, payload);
    if (!updated) throw new DomainError('USER_NOT_FOUND', 'Usuario no encontrado', 404);
    return this.toDto(updated);
  }

  // El middleware requireRole('ADMIN') protege los endpoints de roles y eliminación.
  async updateRoles(id: number, roles: UserRole[]): Promise<UserDto> {
    const updated = await this.repository.update(id, { roles });
    if (!updated) throw new DomainError('USER_NOT_FOUND', 'Usuario no encontrado', 404);
    return this.toDto(updated);
  }

  async delete(id: number): Promise<void> {
    if (!(await this.repository.delete(id))) {
      throw new DomainError('USER_NOT_FOUND', 'Usuario no encontrado', 404);
    }
  }

  async getPublicProfile(id: number): Promise<PublicUserProfileDto> {
    const user = await this.requireUser(id);
    if (!user.isActive) throw new DomainError('USER_NOT_FOUND', 'Usuario no encontrado', 404);
    return this.toPublicProfile(user);
  }

  async getPrivateProfile(id: number): Promise<PrivateUserProfileDto> {
    const user = await this.requireUser(id);
    const publicProfile = await this.toPublicProfile(user);
    return { ...publicProfile, email: user.email, roles: user.roles };
  }
}
