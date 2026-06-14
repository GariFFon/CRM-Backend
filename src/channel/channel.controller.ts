import type { Context } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { messages, campaigns } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { simulateDelivery } from './simulator.js';
import { sendCallback } from './callback.js';

// ─── POST /channel/send ───────────────────────────────────────────────────────
// Entry point from the CRM's send worker. Decides whether to:
//   simulate → auto-fire async callbacks (probability-based)
//   live     → store in inbox, wait for real human interaction

export async function send(c: Context) {
  const body = await c.req.json<{
    messageId: string;
    channel: string;
    recipientContact: string;
    messageBody: string;
    customerId: string;
    customerName: string;
    campaignId: string;
  }>();

  const vendorRef = `stub_${uuidv4()}`;

  // Update message status to 'sent' immediately
  await db
    .update(messages)
    .set({ status: 'sent', vendorRef, sentAt: new Date() })
    .where(eq(messages.id, body.messageId));

  // Look up the campaign's deliveryMode
  const [campaign] = await db
    .select({ deliveryMode: campaigns.deliveryMode })
    .from(campaigns)
    .where(eq(campaigns.id, body.campaignId))
    .limit(1);

  const mode = campaign?.deliveryMode ?? 'simulate';

  console.log(
    `📤 [${mode.toUpperCase().padEnd(8)}] [${body.channel.toUpperCase().padEnd(8)}] → ${body.customerName.padEnd(20)} (${body.recipientContact})`
  );

  if (mode === 'simulate') {
    // Auto-simulate the full lifecycle asynchronously
    simulateDelivery({ messageId: body.messageId, vendorRef, channel: body.channel });
  }
  // In 'live' mode: message stays at 'sent', sitting in the provider inbox
  // until a real human opens/clicks it via /channel/inbox/:id/open|click

  return c.json({ accepted: true, vendorRef, messageId: body.messageId, channel: body.channel, mode }, 202);
}

// ─── GET /channel/inbox ───────────────────────────────────────────────────────
// Returns all messages from live-mode campaigns (for the provider inbox UI)

export async function getInbox(c: Context) {
  const campaignId = c.req.query('campaignId');

  // Get all live-mode campaigns
  const liveCampaigns = await db
    .select({ id: campaigns.id, name: campaigns.name, channel: campaigns.channel })
    .from(campaigns)
    .where(eq(campaigns.deliveryMode, 'live'));

  if (liveCampaigns.length === 0) {
    return c.json({ success: true, data: { campaigns: [], messages: [] } });
  }

  const campaignIds = campaignId
    ? [campaignId]
    : liveCampaigns.map((c) => c.id);

  // Get messages for these campaigns — all statuses so we can show full history
  const rows = await db
    .select()
    .from(messages)
    .where(
      campaignIds.length === 1
        ? eq(messages.campaignId, campaignIds[0])
        : eq(messages.campaignId, campaignIds[0]) // fallback — expanded below
    )
    .orderBy(messages.queuedAt);

  // For multiple campaigns, we fetch individually and merge (simpler than raw SQL here)
  let allMessages = rows;
  if (campaignIds.length > 1) {
    const extra = await Promise.all(
      campaignIds.slice(1).map((id) =>
        db.select().from(messages).where(eq(messages.campaignId, id)).orderBy(messages.queuedAt)
      )
    );
    allMessages = [...rows, ...extra.flat()];
  }

  return c.json({
    success: true,
    data: {
      campaigns: liveCampaigns,
      messages: allMessages,
    },
  });
}

// ─── POST /channel/inbox/:id/open ─────────────────────────────────────────────
// Human opened a message in the inbox → fire 'delivered' then 'opened' callback

export async function openMessage(c: Context) {
  const messageId = c.req.param('id')!;

  const [msg] = await db
    .select({ status: messages.status, vendorRef: messages.vendorRef })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);

  if (!msg) return c.json({ error: 'Message not found' }, 404);

  // If still 'sent', first fire 'delivered' then 'opened'
  if (msg.status === 'sent') {
    await sendCallback({ messageId, vendorRef: msg.vendorRef ?? 'live', status: 'delivered' });
    // Small delay so the state machine sees delivered before opened
    await new Promise((r) => setTimeout(r, 200));
    await sendCallback({ messageId, vendorRef: msg.vendorRef ?? 'live', status: 'opened' });
  } else if (msg.status === 'delivered') {
    await sendCallback({ messageId, vendorRef: msg.vendorRef ?? 'live', status: 'opened' });
  }

  console.log(`👁️  OPENED [LIVE] → ${messageId.slice(0, 8)}...`);
  return c.json({ success: true, messageId, action: 'opened' });
}

// ─── POST /channel/inbox/:id/click ────────────────────────────────────────────
// Human clicked the CTA link → fire 'clicked' callback (and any preceding ones)

export async function clickMessage(c: Context) {
  const messageId = c.req.param('id')!;

  const [msg] = await db
    .select({ status: messages.status, vendorRef: messages.vendorRef })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);

  if (!msg) return c.json({ error: 'Message not found' }, 404);

  const vendorRef = msg.vendorRef ?? 'live';

  // Cascade up the state machine if needed
  if (msg.status === 'sent') {
    await sendCallback({ messageId, vendorRef, status: 'delivered' });
    await new Promise((r) => setTimeout(r, 150));
    await sendCallback({ messageId, vendorRef, status: 'opened' });
    await new Promise((r) => setTimeout(r, 150));
    await sendCallback({ messageId, vendorRef, status: 'clicked' });
  } else if (msg.status === 'delivered') {
    await sendCallback({ messageId, vendorRef, status: 'opened' });
    await new Promise((r) => setTimeout(r, 150));
    await sendCallback({ messageId, vendorRef, status: 'clicked' });
  } else if (msg.status === 'opened') {
    await sendCallback({ messageId, vendorRef, status: 'clicked' });
  }

  console.log(`🖱️  CLICKED [LIVE] → ${messageId.slice(0, 8)}...`);
  return c.json({ success: true, messageId, action: 'clicked' });
}
