import type { Context } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { messages } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { simulateDelivery } from './simulator.js';

export async function send(c: Context) {
  const body = await c.req.json<{
    messageId: string;
    channel: string;
    recipientContact: string;
    messageBody: string;
    customerId: string;
    customerName: string;
  }>();

  // Generate a vendor reference (like a real provider would)
  const vendorRef = `stub_${uuidv4()}`;

  // Update message status to 'sent' immediately
  await db
    .update(messages)
    .set({ status: 'sent', vendorRef, sentAt: new Date() })
    .where(eq(messages.id, body.messageId));

  console.log(
    `📤 SENT [${body.channel.toUpperCase().padEnd(8)}] → ${body.customerName.padEnd(20)} (${body.recipientContact})`
  );

  // Fire async simulation — DO NOT await (returns immediately to caller)
  simulateDelivery({
    messageId: body.messageId,
    vendorRef,
    channel: body.channel,
  });

  // Return 202 Accepted immediately
  return c.json(
    {
      accepted: true,
      vendorRef,
      messageId: body.messageId,
      channel: body.channel,
    },
    202
  );
}
