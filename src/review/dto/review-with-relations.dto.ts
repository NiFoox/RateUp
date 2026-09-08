export interface ReviewWithRelationsDto {
  id: number;
  content: string;
  score: number;
  createdAt: Date;
  updatedAt?: Date | null;
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
