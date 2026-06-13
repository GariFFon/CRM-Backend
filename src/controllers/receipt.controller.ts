import type { Context } from 'hono';
import { processReceipt, type ReceiptStatus } from '../services/receipt.service.js';

export async function handleReceipt(c: Context) {
  const body = await c.req.json<{
    messageId: string;
    vendorRef: string;
    status: ReceiptStatus;
    timestamp?: string;
  }>();

  const result = await processReceipt(body);

  if (result.skipped) {
    return c.json({ success: true, skipped: true, reason: result.reason }, 200);
  }

  return c.json({ success: true, messageId: result.messageId, status: result.status });
}
