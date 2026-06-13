import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in environment variables');
}

// Create postgres connection
const client = postgres(process.env.DATABASE_URL, {
  max: 10, // connection pool size
  idle_timeout: 30,
  connect_timeout: 10,
});

// Create drizzle instance with schema for typed queries
export const db = drizzle(client, { schema });

export type DB = typeof db;
