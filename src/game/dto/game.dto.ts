export interface GameDto {
  id: number;
  name: string;
  description: string;
  genre: string;
}

export interface GamePageDto {
  page: number;
  limit: number;
  total: number;
  data: GameDto[];
}

export type GameListDto = GameDto[] | GamePageDto;
