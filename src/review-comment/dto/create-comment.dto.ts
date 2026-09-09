import { z } from 'zod';

export const ReviewCommentCreateSchema = z
  .object({
    content: z.string().trim().min(1, 'content is required'),
  })
  .strict();

export type ReviewCommentCreateDto = z.infer<typeof ReviewCommentCreateSchema>;
