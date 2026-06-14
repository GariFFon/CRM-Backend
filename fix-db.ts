import { db } from './src/db/index.js';
import { sql } from 'drizzle-orm';

async function run() {
  try {
    await db.execute(sql`CREATE TYPE delivery_mode AS ENUM ('simulate', 'live')`);
    console.log("Created ENUM");
  } catch (e) {
    console.log("ENUM might exist:", e.message);
  }
  
  try {
    await db.execute(sql`ALTER TABLE campaigns ADD COLUMN delivery_mode delivery_mode NOT NULL DEFAULT 'simulate'`);
    console.log("Added column");
  } catch (e) {
    console.log("Column might exist:", e.message);
  }
  process.exit(0);
}

run();
