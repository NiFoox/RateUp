import type { Request, Response } from 'express';
import type { GameRepository } from '../game/game.repository.interface.js';
import type { ReviewRepository } from '../review/review.repository.interface.js';
import type { ValidatedLocals } from '../shared/middlewares/validate.js';
import type {
  TopGamesQueryDto,
  TrendingReviewsQueryDto,
  TopGamesResponseDto,
  TrendingReviewsResponseDto,
} from './dto/home.dto.js';

export class HomeController {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly reviewRepository: ReviewRepository,
  ) {}

  async getTopGames(
    _req: Request,
    res: Response<TopGamesResponseDto, ValidatedLocals<{ query: TopGamesQueryDto }>>,
  ): Promise<void> {
    const { limit, minReviews } = res.locals.validated.query;
    const items = await this.gameRepository.getTopRatedGames(limit, minReviews);
    res.json({ limit, minReviews, count: items.length, items });
  }

  async getTrendingReviews(
    _req: Request,
    res: Response<TrendingReviewsResponseDto, ValidatedLocals<{ query: TrendingReviewsQueryDto }>>,
  ): Promise<void> {
    const { limit, days } = res.locals.validated.query;
    const items = await this.reviewRepository.getTrendingReviews(limit, days);
    res.json({ limit, days, count: items.length, items });
  }
}
