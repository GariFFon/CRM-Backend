import type { MiddlewareHandler } from 'hono';
import type { ZodSchema, ZodError } from 'zod';

/**
 * Validates the request body against a Zod schema.
 * Returns 400 with field-level errors on failure.
 */
export function validate<T>(schema: ZodSchema<T>): MiddlewareHandler {
  return async (c, next) => {
    let body: unknown;

    try {
      body = await c.req.json();
    } catch {
      return c.json({ success: false, error: 'Invalid JSON body' }, 400);
    }

    const result = schema.safeParse(body);

    if (!result.success) {
      const errors = (result.error as ZodError).errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return c.json({ success: false, error: 'Validation failed', errors }, 400);
    }

    // Attach validated data to context
    c.set('body' as never, result.data);
    await next();
  };
}
