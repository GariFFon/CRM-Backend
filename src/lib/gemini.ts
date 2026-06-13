import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is not set in environment variables');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Flash model — fast and cheap, great for structured outputs
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    temperature: 0.7,
    topP: 0.9,
    maxOutputTokens: 2048,
  },
});

// ─── Prompt: Natural Language → Segment Rules ──────────────────────────────

export async function generateSegmentRules(nlQuery: string): Promise<{
  rules: object;
  explanation: string;
}> {
  const prompt = `
You are a CRM segmentation engine. Convert the marketer's natural language query into a structured JSON segment rule.

AVAILABLE FIELDS:
- last_order_at: date of last purchase (use "90d", "30d", "180d", "1y" for relative dates)
- total_spend: total money spent by customer in INR (number)
- order_count: number of orders placed (integer)
- avg_order_value: average order amount in INR (number)
- favourite_category: most purchased category — one of: shoes, clothing, accessories, electronics, home
- city: city name string (e.g. "Mumbai", "Delhi")

OPERATORS:
- lt (less than), lte (less than or equal)
- gt (greater than), gte (greater than or equal)
- eq (equals), neq (not equals)
- in (value is array of strings)

OUTPUT FORMAT (strict JSON, no markdown):
{
  "operator": "AND",
  "conditions": [
    { "field": "last_order_at", "op": "gt", "value": "90d" },
    { "field": "total_spend", "op": "lt", "value": 5000 }
  ]
}

EXAMPLES:
Query: "customers who haven't bought in 90 days"
→ { "operator": "AND", "conditions": [{ "field": "last_order_at", "op": "gt", "value": "90d" }] }

Query: "high value shoe buyers from Mumbai"
→ { "operator": "AND", "conditions": [{ "field": "total_spend", "op": "gt", "value": 10000 }, { "field": "favourite_category", "op": "eq", "value": "shoes" }, { "field": "city", "op": "eq", "value": "Mumbai" }] }

Now convert this query: "${nlQuery}"

Return ONLY a JSON object with two keys: "rules" (the conditions object) and "explanation" (1 sentence explaining who this targets).
`.trim();

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  // Strip markdown code blocks if present
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    return {
      rules: parsed.rules ?? parsed,
      explanation: parsed.explanation ?? 'Customers matching the specified criteria',
    };
  } catch {
    throw new Error('AI returned invalid JSON for segment rules');
  }
}

// ─── Prompt: Segment → Message Copy Variants ──────────────────────────────

export async function generateMessageCopy(params: {
  campaignGoal: string;
  segmentDescription: string;
  channel: string;
}): Promise<Array<{ variant: string; copy: string }>> {
  const charLimits: Record<string, number> = {
    whatsapp: 1000,
    sms: 160,
    email: 500,
    rcs: 800,
  };

  const limit = charLimits[params.channel] ?? 500;

  const prompt = `
You are a marketing copywriter for Indian consumer brands. Write 3 message variants for a campaign.

CAMPAIGN GOAL: ${params.campaignGoal}
TARGET AUDIENCE: ${params.segmentDescription}
CHANNEL: ${params.channel.toUpperCase()} (max ${limit} characters per message)
TONE: Friendly, direct, with a clear call-to-action. Use ₹ for prices. Keep it conversational.

Return a JSON array with exactly 3 objects:
[
  { "variant": "A", "copy": "message text here" },
  { "variant": "B", "copy": "message text here" },
  { "variant": "C", "copy": "message text here" }
]

Return ONLY the JSON array, no markdown, no explanation.
`.trim();

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error('AI returned invalid JSON for message copy');
  }
}

// ─── Prompt: Segment → Channel Recommendation ─────────────────────────────

export async function recommendChannel(segmentDescription: string): Promise<{
  channel: 'whatsapp' | 'sms' | 'email' | 'rcs';
  reasoning: string;
}> {
  const prompt = `
You are a CRM channel strategy expert for Indian markets.

Given this audience segment: "${segmentDescription}"

Recommend the BEST channel to reach them. Channels available: whatsapp, sms, email, rcs.

Indian market context:
- WhatsApp: highest open rates (87%), best for engaged customers, rich media
- SMS: reliable delivery, good for re-engagement, price-sensitive segments
- Email: best for detailed content, higher-value customers, not time-sensitive
- RCS: modern, good for digital-savvy customers, fallback to SMS

Return JSON only:
{ "channel": "whatsapp", "reasoning": "one sentence explanation" }
`.trim();

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    return { channel: 'whatsapp', reasoning: 'WhatsApp has the highest engagement rates in India.' };
  }
}

// ─── Prompt: Campaign Stats → Insights Summary ────────────────────────────

export async function generateCampaignInsights(params: {
  campaignName: string;
  segmentDescription: string;
  stats: {
    total: number;
    sent: number;
    delivered: number;
    failed: number;
    opened: number;
    clicked: number;
  };
  channel: string;
}): Promise<string> {
  const deliveryRate = params.stats.sent > 0
    ? ((params.stats.delivered / params.stats.sent) * 100).toFixed(1)
    : '0';
  const openRate = params.stats.delivered > 0
    ? ((params.stats.opened / params.stats.delivered) * 100).toFixed(1)
    : '0';
  const clickRate = params.stats.opened > 0
    ? ((params.stats.clicked / params.stats.opened) * 100).toFixed(1)
    : '0';

  const prompt = `
You are a CRM analytics expert. Write a brief, insightful performance summary for this campaign.

Campaign: "${params.campaignName}"
Segment: ${params.segmentDescription}
Channel: ${params.channel}
Results:
- Total audience: ${params.stats.total}
- Sent: ${params.stats.sent}
- Delivered: ${params.stats.delivered} (${deliveryRate}% delivery rate)
- Opened: ${params.stats.opened} (${openRate}% open rate)
- Clicked: ${params.stats.clicked} (${clickRate}% click rate)
- Failed: ${params.stats.failed}

Write 2-3 sentences: what worked, what didn't, and one specific recommendation for the next campaign.
Be specific with numbers. Write in plain English, no bullet points.
`.trim();

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
