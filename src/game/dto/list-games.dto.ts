import { z } from 'zod';

const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export const GameListQuerySchema = z.object({
  page: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1).max(2_147_483_647).default(1),
  ),
  limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(100).default(20)),
  search: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  genre: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  all: z.preprocess(
    emptyToUndefined,
    z
      .union([z.boolean(), z.enum(['true', 'false']).transform((value) => value === 'true')])
      .default(false),
  ),
});

export type GameListQueryDto = z.output<typeof GameListQuerySchema>;
