import { Queue, Worker, type ConnectionOptions } from 'bullmq';

if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL is not set in environment variables');
}

// ─── Redis Connection ────────────────────────────────────────────────────────
// BullMQ bundles its own ioredis — pass the URL directly to avoid type conflicts

function parseRedisUrl(url: string): ConnectionOptions {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '6379'),
      password: parsed.password || undefined,
      username: parsed.username || undefined,
      tls: parsed.protocol === 'rediss:' ? {} : undefined,
    };
  } catch {
    // Fallback for simple redis://host:port format
    return { host: 'localhost', port: 6379 };
  }
}

const connection: ConnectionOptions = parseRedisUrl(process.env.REDIS_URL);

// ─── Send Queue ──────────────────────────────────────────────────────────────

export const sendQueue = new Queue('send-messages', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

console.log('✅ BullMQ send queue initialized');

// ─── Send Worker ─────────────────────────────────────────────────────────────

const CHANNEL_URL = process.env.SELF_URL
  ? `${process.env.SELF_URL}/channel/send`
  : 'http://localhost:3001/channel/send';

export function startSendWorker() {
  const worker = new Worker(
    'send-messages',
    async (job) => {
      const {
        messageId,
        channel,
        recipientContact,
        messageBody,
        customerId,
        customerName,
      } = job.data;

      const response = await fetch(CHANNEL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          channel,
          recipientContact,
          messageBody,
          customerId,
          customerName,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Channel send failed: ${response.status} ${text}`);
      }

      return await response.json();
    },
    {
      connection,
      concurrency: 15, // process 15 messages in parallel
    }
  );

  worker.on('completed', (job) => {
    console.log(`✅ Message sent: ${job.data.messageId?.slice(0, 8)}...`);
  });

  worker.on('failed', (job, err) => {
    console.error(
      `❌ Message failed: ${job?.data?.messageId?.slice(0, 8)}... — ${err.message}`
    );
  });

  console.log('🚀 Send worker started (concurrency: 15)');
  return worker;
}
