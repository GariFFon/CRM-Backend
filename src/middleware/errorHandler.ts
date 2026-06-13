import type { ErrorHandler } from 'hono';

export const errorHandler: ErrorHandler = (err, c) => {
  console.error(`❌ Unhandled error on ${c.req.method} ${c.req.path}:`, err);

  // Known application errors
  if (err.message.startsWith('NOT_FOUND:')) {
    return c.json({ success: false, error: err.message.replace('NOT_FOUND: ', '') }, 404);
  }

  if (err.message.startsWith('BAD_REQUEST:')) {
    return c.json({ success: false, error: err.message.replace('BAD_REQUEST: ', '') }, 400);
  }

  if (err.message.startsWith('CONFLICT:')) {
    return c.json({ success: false, error: err.message.replace('CONFLICT: ', '') }, 409);
  }

  // Generic 500
  return c.json(
    {
      success: false,
      error: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { detail: err.message }),
    },
    500
  );
};

// Helper to throw typed errors from services/controllers
export const AppError = {
  notFound: (msg: string) => new Error(`NOT_FOUND: ${msg}`),
  badRequest: (msg: string) => new Error(`BAD_REQUEST: ${msg}`),
  conflict: (msg: string) => new Error(`CONFLICT: ${msg}`),
};
