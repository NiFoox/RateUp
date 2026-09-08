import type { ReviewWithRelationsDto } from './review-with-relations.dto.js';

export type ReviewVoteValue = -1 | 0 | 1;
export interface ReviewDto {
  id: number;
  gameId: number;
  userId: number;
  content: string;
  score: number;
  createdAt: Date;
  updatedAt: Date | null;
}
export interface ReviewVotesDto {
  reviewId: number;
  upvotes: number;
  downvotes: number;
  score: number;
}
export interface ReviewListItemDto extends ReviewDto {
  user: ReviewWithRelationsDto['user'];
  game: ReviewWithRelationsDto['game'];
  comments: number;
  votes: ReviewVotesDto;
  userVote: ReviewVoteValue;
}
export interface ReviewListDto {
  page: number;
  pageSize: number;
  total: number;
  data: ReviewListItemDto[];
}
