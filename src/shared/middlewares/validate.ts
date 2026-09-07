import type { Request, Response, NextFunction } from 'express';
import type { z } from 'zod';

type Where = 'body' | 'params' | 'query';

export type ValidatedLocals<T extends object> = { validated: T };

function validate(schema: z.ZodType, where: Where) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req[where]);
    if (!parsed.success) {
      return next(parsed.error);
    }

    const validated: Partial<Record<Where, unknown>> = res.locals.validated ?? {};
    res.locals.validated = { ...validated, [where]: parsed.data };

    if (where === 'body') req.body = parsed.data;

    next();
  };
}

export const validateBody = (schema: z.ZodType) => validate(schema, 'body');
export const validateParams = (schema: z.ZodType) => validate(schema, 'params');
export const validateQuery = (schema: z.ZodType) => validate(schema, 'query');
