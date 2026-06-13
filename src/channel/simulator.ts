import { CHANNEL_OUTCOMES, randomDelay, pickOutcome } from './outcomes.js';
import { sendCallback } from './callback.js';

/**
 * Simulates the full async lifecycle of a message delivery:
 * queued → sent → delivered/failed → opened → clicked
 *
 * All callbacks are fired asynchronously via setTimeout,
 * mimicking how a real channel provider would send webhooks.
 */
export function simulateDelivery(params: {
  messageId: string;
  vendorRef: string;
  channel: string;
}) {
  const { messageId, vendorRef, channel } = params;
  const outcomes = CHANNEL_OUTCOMES[channel] ?? CHANNEL_OUTCOMES.sms;

  // Fire all callbacks asynchronously — don't await
  runSimulation(messageId, vendorRef, outcomes).catch((err) => {
    console.error(`⚠️  Simulation error for message ${messageId}:`, err.message);
  });
}

async function runSimulation(
  messageId: string,
  vendorRef: string,
  outcomes: (typeof CHANNEL_OUTCOMES)[string]
) {
  // Step 1: Delivery or failure (after delivery delay)
  await sleep(randomDelay(outcomes.deliveryDelay));

  const isDelivered = pickOutcome(outcomes.deliveryRate);
  const isFailed = !isDelivered && pickOutcome(outcomes.failRate / (1 - outcomes.deliveryRate + 0.001));

  if (isDelivered) {
    await sendCallback({ messageId, vendorRef, status: 'delivered' });

    // Step 2: Open (after open delay, conditional on delivery)
    await sleep(randomDelay(outcomes.openDelay));
    const isOpened = pickOutcome(outcomes.openRate);

    if (isOpened) {
      await sendCallback({ messageId, vendorRef, status: 'opened' });

      // Step 3: Click (after click delay, conditional on open)
      await sleep(randomDelay(outcomes.clickDelay));
      const isClicked = pickOutcome(outcomes.clickRate);

      if (isClicked) {
        await sendCallback({ messageId, vendorRef, status: 'clicked' });
      }
    }
  } else if (isFailed) {
    await sendCallback({ messageId, vendorRef, status: 'failed' });
  }
  // else: message stays as 'sent' (pending) — some messages just never get a delivery receipt
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
