import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../shared/middlewares/auth.js';
import type { ValidatedLocals } from '../shared/middlewares/validate.js';
import type { ReviewService } from './review.service.js';
import type { ReviewCreateDto } from './dto/create-review.dto.js';
import type { ReviewUpdateDto } from './dto/update-review.dto.js';
import type { ReviewIdParamDto } from './dto/review-id.dto.js';
import type { ReviewListQueryDto } from './dto/list-reviews.dto.js';
import type { ReviewFullQueryDto, ReviewFullDto } from './dto/full-review.dto.js';
import type { ReviewDto, ReviewListDto } from './dto/review.dto.js';
import type { ReviewWithRelationsDto } from './dto/review-with-relations.dto.js';

export class ReviewController {
  constructor(private readonly service: ReviewService) {}

  async create(
    req: AuthenticatedRequest,
    res: Response<ReviewDto, ValidatedLocals<{ body: ReviewCreateDto }>>,
  ): Promise<void> {
    res
      .status(201)
      .json(await this.service.create(res.locals.validated.body, Number(req.user!.sub)));
  }

  async getById(
    _req: Request,
    res: Response<ReviewDto, ValidatedLocals<{ params: ReviewIdParamDto }>>,
  ): Promise<void> {
    res.json(await this.service.getById(res.locals.validated.params.id));
  }

  async list(
    req: AuthenticatedRequest,
    res: Response<ReviewListDto, ValidatedLocals<{ query: ReviewListQueryDto }>>,
  ): Promise<void> {
    res.json(
      await this.service.list(res.locals.validated.query, req.user ? Number(req.user.sub) : null),
    );
  }

  async listMine(
    req: AuthenticatedRequest,
    res: Response<ReviewListDto, ValidatedLocals<{ query: ReviewListQueryDto }>>,
  ): Promise<void> {
    res.json(await this.service.listMine(res.locals.validated.query, Number(req.user!.sub)));
  }

  async getWithRelations(
    _req: Request,
    res: Response<ReviewWithRelationsDto, ValidatedLocals<{ params: ReviewIdParamDto }>>,
  ): Promise<void> {
    res.json(await this.service.getWithRelations(res.locals.validated.params.id));
  }

  async getFull(
    req: AuthenticatedRequest,
    res: Response<
      ReviewFullDto,
      ValidatedLocals<{ params: ReviewIdParamDto; query: ReviewFullQueryDto }>
    >,
  ): Promise<void> {
    const { params, query } = res.locals.validated;
    res.json(await this.service.getFull(params.id, query, req.user ? Number(req.user.sub) : null));
  }

  async patch(
    req: AuthenticatedRequest,
    res: Response<ReviewDto, ValidatedLocals<{ params: ReviewIdParamDto; body: ReviewUpdateDto }>>,
  ): Promise<void> {
    const { params, body } = res.locals.validated;
    res.json(
      await this.service.patch(params.id, body, {
        id: Number(req.user!.sub),
        roles: req.user!.roles,
      }),
    );
  }

  async delete(
    req: AuthenticatedRequest,
    res: Response<void, ValidatedLocals<{ params: ReviewIdParamDto }>>,
  ): Promise<void> {
    await this.service.delete(res.locals.validated.params.id, {
      id: Number(req.user!.sub),
      roles: req.user!.roles,
    });
    res.status(204).send();
  }
}
