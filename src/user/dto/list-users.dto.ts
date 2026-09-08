import { z } from 'zod';
import { emptyToUndef } from './user-fields.js';

export const UserListQuerySchema = z.object({
  page: z.preprocess(emptyToUndef, z.coerce.number().int().min(1).default(1)),
  pageSize: z.preprocess(emptyToUndef, z.coerce.number().int().min(1).max(100).default(10)),
  search: z.preprocess(emptyToUndef, z.string().trim().optional()),
});

export type UserListQueryDto = z.output<typeof UserListQuerySchema>;
