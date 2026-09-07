import { z } from 'zod';

export const GameCreateSchema = z.strictObject({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1),
  genre: z.string().trim().min(1).max(100),
});

export type GameCreateDto = z.output<typeof GameCreateSchema>;
