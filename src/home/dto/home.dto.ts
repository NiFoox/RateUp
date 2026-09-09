import { z } from 'zod';
import type { TopGameDto } from '../../game/dto/top-game.dto.js';
import type { TrendingReviewDto } from '../../review/dto/trending-review.dto.js';

const integerQuery = z.string().trim().min(1).pipe(z.coerce.number<string>().int());
const limit = integerQuery.pipe(z.number().min(1).max(50)).default(10);
export const TopGamesQuerySchema = z.object({
  limit,
  minReviews: integerQuery.pipe(z.number().min(0)).default(1),
});
export const TrendingReviewsQuerySchema = z.object({
  limit,
  days: integerQuery.pipe(z.number().min(1).max(30)).default(7),
});
export type TopGamesQueryDto = z.output<typeof TopGamesQuerySchema>;
export type TrendingReviewsQueryDto = z.output<typeof TrendingReviewsQuerySchema>;
export interface TopGamesResponseDto extends TopGamesQueryDto {
  count: number;
  items: TopGameDto[];
}
export interface TrendingReviewsResponseDto extends TrendingReviewsQueryDto {
  count: number;
  items: TrendingReviewDto[];
}
