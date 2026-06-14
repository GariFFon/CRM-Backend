/**
 * In-process send queue — replaces BullMQ so no Redis is needed.
 *
 * Architecture is identical to the BullMQ version:
 *   launchCampaign() → enqueue jobs → worker picks them up → POST /channel/send
 *   Channel stub fires async callbacks → POST /api/receipts → stats updated
 *
 * The queue runs fully in-memory inside the same Node.js process.
 * Concurrency, retry with exponential backoff, and error logging are all preserved.
 */

export interface SendJob {
  messageId: string;
  campaignId: string;
  channel: string;
  recipientContact: string;
  messageBody: string;
  customerId: string;
  customerName: string;
}

// ─── Simple async in-process queue ───────────────────────────────────────────

const CONCURRENCY = 15;        // process up to 15 messages in parallel
const MAX_ATTEMPTS = 3;        // retry failed sends up to 3 times
const BASE_BACKOFF_MS = 2000;  // exponential backoff: 2s, 4s, 8s

let activeWorkers = 0;
const jobQueue: SendJob[] = [];

const CHANNEL_URL = process.env.SELF_URL
  ? `${process.env.SELF_URL}/channel/send`
  : 'http://localhost:3001/channel/send';

/**
 * Public API: add a batch of send jobs.
 * Mirrors BullMQ's sendQueue.addBulk() interface.
 */
export const sendQueue = {
  addBulk(jobs: { name: string; data: SendJob }[]) {
    for (const job of jobs) {
      jobQueue.push(job.data);
    }
    // Kick off workers up to CONCURRENCY limit
    drainQueue();
    return Promise.resolve();
  },
};

export function startSendWorker() {
  // With the in-process queue, the "worker" is just drainQueue().
  // This function exists for API compatibility with the BullMQ version.
  console.log('🚀 In-process send worker ready (concurrency: ' + CONCURRENCY + ')');
}

// ─── Queue drain logic ────────────────────────────────────────────────────────

function drainQueue() {
  while (activeWorkers < CONCURRENCY && jobQueue.length > 0) {
    const job = jobQueue.shift()!;
    activeWorkers++;
    processJob(job)
      .catch((err) => {
        console.error(`❌ Job permanently failed for ${job.messageId?.slice(0, 8)}...: ${err.message}`);
      })
      .finally(() => {
        activeWorkers--;
        drainQueue(); // pull next job when a slot frees up
      });
  }
}

async function processJob(job: SendJob, attempt = 1): Promise<void> {
  try {
    const response = await fetch(CHANNEL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId:        job.messageId,
        campaignId:       job.campaignId,
        channel:          job.channel,
        recipientContact: job.recipientContact,
        messageBody:      job.messageBody,
        customerId:       job.customerId,
        customerName:     job.customerName,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Channel send failed: ${response.status} ${text}`);
    }

    console.log(`✅ Message sent: ${job.messageId?.slice(0, 8)}...`);
  } catch (err) {
    if (attempt < MAX_ATTEMPTS) {
      const delay = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
      console.warn(`⚠️  Send attempt ${attempt} failed for ${job.messageId?.slice(0, 8)}..., retrying in ${delay}ms`);
      await sleep(delay);
      return processJob(job, attempt + 1);
    }
    throw err;
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

console.log('✅ In-process send queue initialized (no Redis required)');
