import type { UserRole } from '../user.entity.js';

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

export interface UserListDto {
  page: number;
  pageSize: number;
  total: number;
  data: UserDto[];
}

export interface UserProfileReputationDto {
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
    reputation: UserProfileReputationDto;
  };
}

export interface PrivateUserProfileDto extends PublicUserProfileDto {
  email: string;
  roles: UserRole[];
}
