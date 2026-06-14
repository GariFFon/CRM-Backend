/**
 * Fires delivery status updates directly into the receipt service.
 *
 * Previously this made an HTTP POST to SELF_URL/api/receipts, which broke
 * in production (Render) because localhost doesn't resolve there.
 * Now it calls processReceipt() directly — no network hop needed.
 */

import { processReceipt } from '../services/receipt.service.js';

export async function sendCallback(params: {
  messageId: string;
  vendorRef: string;
  status: 'delivered' | 'failed' | 'opened' | 'clicked';
}): Promise<void> {
  let attempt = 0;
  const maxAttempts = 3;

  while (attempt < maxAttempts) {
    try {
      await processReceipt({
        messageId: params.messageId,
        vendorRef: params.vendorRef,
        status: params.status,
        timestamp: new Date().toISOString(),
      });

      console.log(
        `📬 Callback sent: ${params.status.toUpperCase().padEnd(10)} → ${params.messageId.slice(0, 8)}...`
      );
      return;
    } catch (err) {
      console.warn(`⚠️  Callback failed (attempt ${attempt + 1}):`, (err as Error).message);
    }

    attempt++;
    if (attempt < maxAttempts) {
      // Exponential backoff: 2s, 4s
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }

  console.error(`❌ Callback permanently failed for message ${params.messageId} (${params.status})`);
}
