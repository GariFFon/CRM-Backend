/**
 * Core send logic extracted from channel.controller.ts so it can be called
 * directly by the in-process send queue — no HTTP round-trip required.
 *
 * This eliminates the dependency on SELF_URL and makes the system work
 * correctly in any environment (local, Render, etc.).
 */

import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { messages, campaigns } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { simulateDelivery } from './simulator.js';
import type { SendJob } from '../queues/sendQueue.js';

export async function processChannelSend(job: SendJob): Promise<void> {
  const vendorRef = `stub_${uuidv4()}`;

  // Update message status to 'sent' immediately
  await db
    .update(messages)
    .set({ status: 'sent', vendorRef, sentAt: new Date() })
    .where(eq(messages.id, job.messageId));

  // Look up the campaign's deliveryMode
  const [campaign] = await db
    .select({ deliveryMode: campaigns.deliveryMode })
    .from(campaigns)
    .where(eq(campaigns.id, job.campaignId))
    .limit(1);

  const mode = campaign?.deliveryMode ?? 'simulate';

  console.log(
    `📤 [${mode.toUpperCase().padEnd(8)}] [${job.channel.toUpperCase().padEnd(8)}] → ${job.customerName.padEnd(20)} (${job.recipientContact})`
  );

  if (mode === 'simulate') {
    // Auto-simulate the full lifecycle asynchronously (fire-and-forget)
    simulateDelivery({ messageId: job.messageId, vendorRef, channel: job.channel });
  }
  // In 'live' mode: message stays at 'sent', waiting for inbox interaction
}
