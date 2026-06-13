// ─── Weighted outcome probabilities per channel ───────────────────────────────
// These mimic real-world delivery rates in the Indian market

export type ChannelOutcome = {
  deliveryRate: number;   // probability of successful delivery
  failRate: number;       // probability of failure
  openRate: number;       // conditional: given delivered, probability of open
  clickRate: number;      // conditional: given opened, probability of click
  deliveryDelay: [number, number]; // [min, max] seconds to delivery callback
  openDelay: [number, number];     // [min, max] seconds after delivery to open callback
  clickDelay: [number, number];    // [min, max] seconds after open to click callback
};

export const CHANNEL_OUTCOMES: Record<string, ChannelOutcome> = {
  whatsapp: {
    deliveryRate: 0.87,
    failRate: 0.08,
    openRate: 0.62,
    clickRate: 0.24,
    deliveryDelay: [2, 8],
    openDelay: [5, 20],
    clickDelay: [3, 15],
  },
  sms: {
    deliveryRate: 0.72,
    failRate: 0.20,
    openRate: 0.35,
    clickRate: 0.12,
    deliveryDelay: [1, 5],
    openDelay: [10, 60],
    clickDelay: [5, 30],
  },
  email: {
    deliveryRate: 0.65,
    failRate: 0.25,
    openRate: 0.38,
    clickRate: 0.18,
    deliveryDelay: [3, 12],
    openDelay: [30, 120],
    clickDelay: [10, 60],
  },
  rcs: {
    deliveryRate: 0.80,
    failRate: 0.12,
    openRate: 0.50,
    clickRate: 0.20,
    deliveryDelay: [2, 10],
    openDelay: [8, 40],
    clickDelay: [4, 20],
  },
};

export function randomDelay(range: [number, number]): number {
  const [min, max] = range;
  return (Math.random() * (max - min) + min) * 1000; // convert to ms
}

export function pickOutcome(rate: number): boolean {
  return Math.random() < rate;
}
