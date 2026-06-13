import { db } from '../db/index.js';
import { processedReceipts } from '../db/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Checks if a receipt (messageId + status combo) has already been processed.
 * Returns true if it was already processed (skip it), false if it's new (process it).
 */
export async function isAlreadyProcessed(
  messageId: string,
  status: string
): Promise<boolean> {
  const key = `${messageId}_${status}`;
  const existing = await db
    .select()
    .from(processedReceipts)
    .where(eq(processedReceipts.id, key))
    .limit(1);

  return existing.length > 0;
}

/**
 * Marks a receipt as processed (idempotency store).
 */
export async function markAsProcessed(
  messageId: string,
  status: string
): Promise<void> {
  const key = `${messageId}_${status}`;
  await db
    .insert(processedReceipts)
    .values({ id: key })
    .onConflictDoNothing(); // safe to call multiple times
}
