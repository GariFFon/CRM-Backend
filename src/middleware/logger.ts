import type { MiddlewareHandler } from 'hono';

export const logger: MiddlewareHandler = async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;

  await next();

  const ms = Date.now() - start;
  const status = c.res.status;

  const statusColor =
    status >= 500 ? '\x1b[31m' : // red
    status >= 400 ? '\x1b[33m' : // yellow
    status >= 200 ? '\x1b[32m' : // green
    '\x1b[0m';

  const methodColor = '\x1b[36m'; // cyan
  const reset = '\x1b[0m';

  console.log(
    `${methodColor}${method.padEnd(7)}${reset} ${path.padEnd(45)} ${statusColor}${status}${reset} ${ms}ms`
  );
};
