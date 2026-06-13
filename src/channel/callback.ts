const SELF_URL = process.env.SELF_URL ?? 'http://localhost:3001';
const RECEIPTS_URL = `${SELF_URL}/api/receipts`;

/**
 * POSTs a delivery status callback to our own /api/receipts endpoint.
 * This mimics how a real channel provider sends webhooks back to our CRM.
 * Implements retry with exponential backoff for reliability.
 */
export async function sendCallback(params: {
  messageId: string;
  vendorRef: string;
  status: 'delivered' | 'failed' | 'opened' | 'clicked';
}): Promise<void> {
  const body = {
    messageId: params.messageId,
    vendorRef: params.vendorRef,
    status: params.status,
    timestamp: new Date().toISOString(),
  };

  let attempt = 0;
  const maxAttempts = 3;

  while (attempt < maxAttempts) {
    try {
      const response = await fetch(RECEIPTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        console.log(
          `📬 Callback sent: ${params.status.toUpperCase().padEnd(10)} → ${params.messageId.slice(0, 8)}...`
        );
        return;
      }

      console.warn(`⚠️  Callback returned ${response.status}, retrying...`);
    } catch (err) {
      console.warn(`⚠️  Callback failed (attempt ${attempt + 1}):`, (err as Error).message);
    }

    attempt++;
    if (attempt < maxAttempts) {
      // Exponential backoff: 1s, 2s, 4s
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }

  console.error(`❌ Callback permanently failed for message ${params.messageId} (${params.status})`);
}
