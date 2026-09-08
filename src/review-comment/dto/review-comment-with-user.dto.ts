export interface ReviewCommentWithUserDto {
  id: number;
  reviewId: number;
  content: string;
  createdAt: Date;
  updatedAt?: Date | null;
  user: {
    id: number;
    username: string;
  };
}
