import type { Response } from 'express';
import type { AuthenticatedRequest } from '../shared/middlewares/auth.js';
import type { ValidatedLocals } from '../shared/middlewares/validate.js';
import type { ReviewVoteService } from './review-vote.service.js';
import type {
  ReviewVoteParamsDto,
  ReviewVoteBodyDto,
  ReviewVoteSummaryResponseDto,
  ReviewVoteUpsertResponseDto,
  ReviewVoteDeleteResponseDto,
} from './dto/review-vote.dto.js';

export class ReviewVoteController {
  constructor(private readonly service: ReviewVoteService) {}

  async getSummary(
    req: AuthenticatedRequest,
    res: Response<ReviewVoteSummaryResponseDto, ValidatedLocals<{ params: ReviewVoteParamsDto }>>,
  ): Promise<void> {
    res.json(
      await this.service.getSummary(
        res.locals.validated.params.reviewId,
        req.user ? Number(req.user.sub) : null,
      ),
    );
  }

  async upsert(
    req: AuthenticatedRequest,
    res: Response<
      ReviewVoteUpsertResponseDto,
      ValidatedLocals<{ params: ReviewVoteParamsDto; body: ReviewVoteBodyDto }>
    >,
  ): Promise<void> {
    const { params, body } = res.locals.validated;
    res
      .status(200)
      .json(await this.service.upsert(params.reviewId, Number(req.user!.sub), body.value));
  }

  async remove(
    req: AuthenticatedRequest,
    res: Response<ReviewVoteDeleteResponseDto, ValidatedLocals<{ params: ReviewVoteParamsDto }>>,
  ): Promise<void> {
    res
      .status(200)
      .json(await this.service.remove(res.locals.validated.params.reviewId, Number(req.user!.sub)));
  }
}
