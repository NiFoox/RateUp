import type { Request, Response } from 'express';
import type { ValidatedLocals } from '../shared/middlewares/validate.js';
import type { GameService } from './game.service.js';
import type { GameCreateDto } from './dto/create-game.dto.js';
import type { GameUpdateDto } from './dto/update-game.dto.js';
import type { GameIdParamDto } from './dto/game-id.dto.js';
import type { GameListQueryDto } from './dto/list-games.dto.js';
import type { GameDto, GameListDto } from './dto/game.dto.js';

export class GameController {
  constructor(private readonly service: GameService) {}

  async create(
    _req: Request,
    res: Response<GameDto, ValidatedLocals<{ body: GameCreateDto }>>,
  ): Promise<void> {
    const game = await this.service.create(res.locals.validated.body);
    res.status(201).location(`/api/games/${game.id}`).json(game);
  }

  async getById(
    _req: Request,
    res: Response<GameDto, ValidatedLocals<{ params: GameIdParamDto }>>,
  ): Promise<void> {
    const game = await this.service.getById(res.locals.validated.params.id);
    res.json(game);
  }

  async list(
    _req: Request,
    res: Response<GameListDto, ValidatedLocals<{ query: GameListQueryDto }>>,
  ): Promise<void> {
    res.json(await this.service.list(res.locals.validated.query));
  }

  async patch(
    _req: Request,
    res: Response<GameDto, ValidatedLocals<{ params: GameIdParamDto; body: GameUpdateDto }>>,
  ): Promise<void> {
    const { params, body } = res.locals.validated;
    res.json(await this.service.patch(params.id, body));
  }

  async delete(
    _req: Request,
    res: Response<void, ValidatedLocals<{ params: GameIdParamDto }>>,
  ): Promise<void> {
    await this.service.delete(res.locals.validated.params.id);
    res.status(204).send();
  }
}
