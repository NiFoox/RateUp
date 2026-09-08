import { z } from 'zod';

// helper: "" -> undefined
const emptyToUndef = (rawValue: unknown) =>
  typeof rawValue === 'string' && rawValue.trim() === '' ? undefined : rawValue;

// ---------- Params ----------

// /api/reviews/:reviewId/comments
export const ReviewCommentBaseParamsSchema = z.object({
  reviewId: z.coerce.number().int().positive(),
});

// /api/reviews/:reviewId/comments/:commentId
export const ReviewCommentWithIdParamsSchema =
  ReviewCommentBaseParamsSchema.extend({
    commentId: z.coerce.number().int().positive(),
  });

// ---------- Body ----------

// Crear comentario
export const ReviewCommentCreateSchema = z
  .object({
    content: z.string().trim().min(1, 'content is required'),
  })
  .strict();

// PATCH comentario (por ahora solo dejamos editar el content)
export const ReviewCommentUpdateSchema = z
  .object({
    content: z.string().trim().min(1, 'content is required').optional(),
  })
  .strict();

// ---------- Query ----------

export const ReviewCommentListQuerySchema = z.object({
  page: z.preprocess(
    emptyToUndef,
    z.coerce.number().int().min(1).default(1),
  ),
  pageSize: z.preprocess(
    emptyToUndef,
    z.coerce.number().int().min(1).default(10),
  ),
});

// ---------- Types ----------

export type ReviewCommentBaseParamsDto = z.infer<
  typeof ReviewCommentBaseParamsSchema
>;
export type ReviewCommentWithIdParamsDto = z.infer<
  typeof ReviewCommentWithIdParamsSchema
>;
export type ReviewCommentCreateDto = z.infer<
  typeof ReviewCommentCreateSchema
>;
export type ReviewCommentUpdateDto = z.infer<
  typeof ReviewCommentUpdateSchema
>;
export type ReviewCommentListQueryDto = z.infer<
  typeof ReviewCommentListQuerySchema
>;
