import type { z } from 'zod';
import { GameCreateSchema } from './create-game.dto.js';

export const GameUpdateSchema = GameCreateSchema.partial();

export type GameUpdateDto = z.output<typeof GameUpdateSchema>;
