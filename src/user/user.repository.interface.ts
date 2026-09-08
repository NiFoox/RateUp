import type { User } from './user.entity.js';

export type UserUpdateData = Partial<Pick<User,
  'username' | 'email' | 'passwordHash' | 'roles' | 'isActive' | 'avatarUrl' | 'bio'
>>;

export interface UserProfileStats {
  reviewsCount: number;
  upvotes: number;
  downvotes: number;
}

export interface UserRepository {
  create(user: User): Promise<User>;
  findById(id: number): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  search(
    page: number,
    pageSize: number,
    searchTerm?: string,
  ): Promise<{ data: User[]; total: number }>;
  update(id: number, data: UserUpdateData): Promise<User | undefined>;
  delete(id: number): Promise<boolean>;

  getProfileStats(userId: number): Promise<UserProfileStats>;
}
