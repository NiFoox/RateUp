import { z } from 'zod';

// helper: "" -> undefined
const emptyToUndef = (rawValue: unknown) =>
  typeof rawValue === 'string' && rawValue.trim() === '' ? undefined : rawValue;

// ---------- Body schemas ----------

const ReviewBaseSchema = z
  .object({
    gameId: z.coerce.number().int().positive(),
    content: z.string().trim().min(1),
    score: z.coerce.number().int().min(1).max(5),
  })
  .strict();

export const ReviewCreateSchema = ReviewBaseSchema;

export const ReviewUpdateSchema = ReviewBaseSchema.partial().strict();

// ---------- Params schema ----------

export const ReviewIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// ---------- Query schema ----------

export const ReviewListQuerySchema = z.object({
  page: z.preprocess(
    emptyToUndef,
    z.coerce.number().int().min(1).default(1),
  ),
  pageSize: z.preprocess(
    emptyToUndef,
    z.coerce.number().int().min(1).max(100).default(10),
  ),
  gameId: z.preprocess(
    emptyToUndef,
    z.coerce.number().int().positive().optional(),
  ),
  userId: z.preprocess(
    emptyToUndef,
    z.coerce.number().int().positive().optional(),
  ),
  search: z.preprocess(
    emptyToUndef,
    z.string().trim().min(1).optional(),
  ),
});

// ---------- Types (DTOs) ----------

export type ReviewCreateDto = z.infer<typeof ReviewCreateSchema>;
export type ReviewUpdateDto = z.infer<typeof ReviewUpdateSchema>;
export type ReviewIdParamDto = z.infer<typeof ReviewIdParamSchema>;
export type ReviewListQueryDto = z.infer<typeof ReviewListQuerySchema>;
