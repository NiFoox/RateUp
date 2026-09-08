export interface TrendingReviewDto {
  id: number;
  content: string;
  score: number;
  createdAt: Date;
  voteScore: number;

  user: {
    id: number;
    username: string;
  };

  game: {
    id: number;
    name: string;
    genre: string;
  };
}
