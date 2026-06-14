import { cors } from 'hono/cors';

export const corsMiddleware = cors({
  origin: (origin) => {
    const allowed = [
      process.env.FRONTEND_URL ?? 'http://localhost:3000',
      'http://localhost:3000',
      'http://localhost:3001',
      'https://crm-frontend-kappa-plum.vercel.app'
    ];
    
    // Allow vercel preview deployments
    if (origin && origin.endsWith('.vercel.app')) {
      return origin;
    }

    return allowed.includes(origin) ? origin : allowed[0];
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  exposeHeaders: ['X-Request-Id'],
  maxAge: 86400,
  credentials: false,
});
