export interface ReviewCommentDto {
  id: number;
  reviewId: number;
  userId: number;
  content: string;
  createdAt: Date;
  updatedAt: Date | null;
}
