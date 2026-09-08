import { z } from 'zod';

// helper: "" -> undefined para default/optional
const emptyToUndef = (rawValue: unknown) =>
  typeof rawValue === 'string' && rawValue.trim() === '' ? undefined : rawValue;

const UserRoleSchema = z.enum(['USER', 'ADMIN']);
// ---------- Body schemas ----------

const UserBaseSchema = z
  .object({
    username: z.string().trim().min(1, 'username is required'),
    email: z.string().trim().pipe(z.email({ message: 'invalid email' })),
    password: z.string().min(8, 'password must be at least 8 characters'),
    roles: z.array(UserRoleSchema).min(1, 'roles must have at least one role'),
    isActive: z.boolean().default(true),
  })
  .strict();

// Crear usuario
export const UserCreateSchema = UserBaseSchema;

// Actualizar usuario (parcial)
export const UserUpdateSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(1, 'username is required')
      .optional(),
    email: z
      .string()
      .trim()
      .pipe(z.email({ message: 'invalid email' }))
      .optional(),
    password: z
      .string()
      .min(8, 'password must be at least 8 characters')
      .optional(),
    isActive: z.boolean().optional(),

    avatarUrl: z
      .preprocess(
        emptyToUndef,
        z
          .string()
          .trim()
          .url('avatarUrl must be a valid URL')
          .nullable()
          .optional(),
      ),
    bio: z.preprocess(
      emptyToUndef,
      z
        .string()
        .trim()
        .max(300, 'bio must be at most 300 characters')
        .nullable()
        .optional(),
    ),
  })
  .strict();

// Actualizar roles (admin)
export const UserRolesUpdateSchema = z.object({
  roles: z.array(UserRoleSchema).min(1, 'roles must have at least one role'),
});

// ---------- Params ----------

export const UserIdParamSchema = z
  .object({
    id: z.coerce.number().int().positive(),
  })
  .strict();

// ---------- Query (listado paginado) ----------

export const UserListQuerySchema = z.object({
  page: z.preprocess(
    emptyToUndef,
    z.coerce.number().int().min(1).default(1),
  ),
  pageSize: z.preprocess(
    emptyToUndef,
    z.coerce.number().int().min(1).max(100).default(10),
  ),
  search: z.preprocess(emptyToUndef, z.string().trim().optional()),
});

// ---------- Types (DTOs) ----------

export type UserCreateDto = z.infer<typeof UserCreateSchema>;
export type UserUpdateDto = z.infer<typeof UserUpdateSchema>;
export type UserIdParamDto = z.infer<typeof UserIdParamSchema>;
export type UserListQueryDto = z.infer<typeof UserListQuerySchema>;
export type UserRolesUpdateDto = z.infer<typeof UserRolesUpdateSchema>;
