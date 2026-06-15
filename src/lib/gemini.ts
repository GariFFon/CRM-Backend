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

// ─── Prompt: Segment Profile → Pre-Launch Risk Insights ───────────────────────

// Indian festival & seasonal calendar for market-aware risk analysis
function getIndianMarketContext(): string {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-indexed
  const day = now.getDate();
  const year = now.getFullYear();
  const currentDateStr = now.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata',
  });

  // Upcoming festivals within ~60 days
  const festivalWindows: { start: [number, number]; end: [number, number]; name: string; impact: string }[] = [
    { start: [1, 1],   end: [1, 15],  name: 'New Year Post-Festivities',    impact: 'High post-holiday spending fatigue; budgets reset. Good for re-engagement campaigns.' },
    { start: [1, 14],  end: [1, 16],  name: 'Makar Sankranti / Pongal / Lohri', impact: 'Regional harvest festivals. Strong in TN, Punjab, Gujarat. Gift hampers & sweets trend.' },
    { start: [2, 1],   end: [2, 14],  name: 'Valentine\'s Day Season',       impact: 'Gifting surge — fashion, jewelry, experiences. High competition from D2C brands.' },
    { start: [2, 26],  end: [3, 10],  name: 'Holi Season',                   impact: 'Colors, fashion, home decor surge. Strong in North India. High WhatsApp engagement.' },
    { start: [3, 15],  end: [3, 31],  name: 'Financial Year-End Sale',       impact: 'Last-minute spending, tax-saving investments. High intent for premium products.' },
    { start: [4, 1],   end: [4, 15],  name: 'Ugadi / Gudi Padwa / Baisakhi', impact: 'New year for South & West India. Auspicious purchases — gold, electronics, vehicles.' },
    { start: [5, 10],  end: [5, 12],  name: 'Mother\'s Day',                  impact: 'Gift-giving spike. Strong for apparel, beauty, personalized products.' },
    { start: [6, 1],   end: [8, 31],  name: 'Monsoon / Mid-Year Lull',        impact: 'Generally lower discretionary spend. Good time for clearance sales and re-engagement.' },
    { start: [8, 15],  end: [8, 20],  name: 'Independence Day Sale',          impact: 'Major e-commerce sale period. High competition from Flipkart & Amazon. SMS saturation risk.' },
    { start: [8, 20],  end: [9, 10],  name: 'Onam Season',                    impact: 'Kerala\'s biggest shopping festival. Strong for gold, sarees, electronics in South India.' },
    { start: [9, 15],  end: [10, 5],  name: 'Navratri / Durga Puja Season',   impact: 'Fashion, ethnic wear, jewelry surge. West Bengal & Gujarat are hotspots.' },
    { start: [10, 1],  end: [10, 31], name: 'Dussehra / Pre-Diwali Season',   impact: 'Peak shopping season begins. Electronics, gold, home. Highest ROI window of the year.' },
    { start: [10, 20], end: [11, 15], name: 'Diwali / Dhanteras Peak',         impact: 'Highest consumer spend of the year. Extreme channel saturation — differentiate or pay premium CPM.' },
    { start: [11, 1],  end: [11, 30], name: 'Post-Diwali & Children\'s Day',  impact: 'Spending slowdown post-Diwali. Good for clearance and loyalty campaigns.' },
    { start: [12, 1],  end: [12, 25], name: 'End-of-Year Sale / Christmas',   impact: 'Year-end budget flush. Strong in Tier-1 metros. Electronics and travel trending.' },
    { start: [12, 20], end: [12, 31], name: 'New Year Countdown',             impact: 'Experiences, fashion, luxury surge. High engagement window for premium segments.' },
  ];

  const activeOrUpcoming = festivalWindows.filter(f => {
    const start = new Date(year, f.start[0] - 1, f.start[1]);
    const end = new Date(year, f.end[0] - 1, f.end[1]);
    const sixtyDaysLater = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    return end >= now && start <= sixtyDaysLater;
  });

  const festivalContext = activeOrUpcoming.length > 0
    ? activeOrUpcoming.map(f => `  • ${f.name}: ${f.impact}`).join('\n')
    : '  • No major festivals in the next 60 days — standard engagement window, good for evergreen campaigns.';

  // Seasonal trend context
  let seasonalTrend = '';
  if (month >= 3 && month <= 5) seasonalTrend = 'SUMMER (Mar–May): AC, beverages, summer fashion, travel & hill-station experiences trending. Heat-related messaging resonates.';
  else if (month >= 6 && month <= 8) seasonalTrend = 'MONSOON (Jun–Aug): Rainwear, home comfort, food delivery, indoor entertainment trending. Lower footfall in physical stores.';
  else if (month >= 9 && month <= 11) seasonalTrend = 'FESTIVE SEASON (Sep–Nov): Peak consumer spend. Electronics, ethnic wear, jewelry, home decor dominate. Highest competition for inbox attention.';
  else seasonalTrend = 'WINTER (Dec–Feb): Winter wear, weddings, travel, gifting dominant. Metro markets outperform Tier-2 in discretionary spend.';

  return `
CURRENT DATE (IST): ${currentDateStr}
CURRENT SEASON: ${seasonalTrend}

UPCOMING FESTIVALS & MARKET WINDOWS (next 60 days):
${festivalContext}

INDIAN MARKET BEHAVIORAL BENCHMARKS:
- WhatsApp open rate: 85–92% (highest channel in India)
- SMS delivery: reliable but 35–45% read rate; best for Tier-2/3 cities and older demographics
- Email open rate: 18–28%; best for B2B, premium, and educated urban segments
- RCS: 60–70% read rate; best for digital-native segments in metros
- Peak engagement hours: 8–10 AM (commute), 1–2 PM (lunch), 7–10 PM (evening)
- Weekend vs. weekday: Financial products — weekday; Fashion/Food — weekend
- Regional sensitivity: South India prefers vernacular content; North India responds to aggressive discounts; West India (Mumbai/Pune/Ahmedabad) responds to exclusivity messaging

CHANNEL SATURATION RISK DURING FESTIVALS:
- During Diwali/Durga Puja/Dussehra: ALL channels are heavily saturated. Need 20–30% higher offer to break through.
- During Independence Day / Republic Day sales: SMS & WhatsApp blast overload — deliverability drops 10–15%.
- Non-festival periods: 40–60% lower competition = better ROI per rupee spent.

RECENT INDIAN CONSUMER TRENDS (2025–2026):
- Quick Commerce (Blinkit, Zepto, Swiggy Instamart) has shifted impulse buying behavior — customers expect instant gratification in messaging too
- UPI-linked offers (Google Pay, PhonePe cashbacks) significantly boost conversion for mid-spend segments
- Vernacular content (Hindi, Tamil, Telugu) drives 2–3x higher engagement vs. English for Tier-2+ cities
- Video & GIF content in WhatsApp drives 40% higher click-through than text-only messages
- Subscription fatigue is rising — frequency capping is critical for premium segments
- Gen-Z audience (18–25) highly responsive to meme-culture, FOMO messaging, and limited-edition drops
- Premium D2C brands outperform in metro markets; mass brands dominate Tier-2/3`.trim();
}

export async function generatePreLaunchInsights(params: {
  segmentName: string;
  segmentDescription: string | null;
  audienceSize: number;
  channel: string;
  spendStats: { min: number; max: number; avg: number };
  topCities: string[];
}): Promise<{
  riskLevel: 'low' | 'medium' | 'high';
  riskSummary: string;
  bestTimeToSend: string;
  tips: string[];
}> {
  const marketContext = getIndianMarketContext();

  const prompt = `
You are a senior CRM campaign strategist specializing in the Indian market. Your risk analysis must be grounded in real Indian consumer behavior, festival cycles, seasonal patterns, and regional market dynamics.

─── CAMPAIGN DETAILS ───────────────────────────────────────────
SEGMENT: "${params.segmentName}"
DESCRIPTION: ${params.segmentDescription ?? 'No description provided'}
AUDIENCE SIZE: ${params.audienceSize.toLocaleString()} customers
CHANNEL: ${params.channel.toUpperCase()}
SPEND RANGE: ₹${params.spendStats.min.toLocaleString('en-IN')} – ₹${params.spendStats.max.toLocaleString('en-IN')} (avg ₹${params.spendStats.avg.toLocaleString('en-IN')})
TOP CITIES: ${params.topCities.length > 0 ? params.topCities.join(', ') : 'Pan-India / Various'}

─── INDIAN MARKET INTELLIGENCE ─────────────────────────────────
${marketContext}

─── YOUR TASK ──────────────────────────────────────────────────
Analyze the campaign considering:
1. AUDIENCE RISK: Is the audience size sufficient? Does the spend profile indicate intent?
2. CHANNEL RISK: Is this channel appropriate for these cities, spend range, and current season?
3. TIMING RISK: Is this the right time given Indian festivals and market trends? Is the market saturated?
4. REGIONAL RISK: Do the top cities align with the message style and channel behavior?
5. TREND ALIGNMENT: Does this campaign align with or conflict with current Indian consumer trends?

Return a JSON object with EXACTLY these keys:
{
  "riskLevel": "low" | "medium" | "high",
  "riskSummary": "2-3 sentences grounded in Indian market context — mention specific festivals, trends, or regional factors that apply. Be specific and actionable, not generic.",
  "bestTimeToSend": "Specific day range and time in IST, e.g. 'Tuesday–Thursday, 7–9 PM IST' — factor in the current season and any nearby festivals",
  "tips": [
    "Specific tip referencing Indian market realities (festival timing, regional preference, channel behavior)",
    "Specific tip about message content or offer structure for Indian audience",
    "Specific tip about frequency, timing, or competitive differentiation given current market window"
  ]
}

Risk calibration for Indian market:
- LOW: Audience >500, channel well-matched, not in peak saturation window, spend profile shows intent, cities align with channel behavior
- MEDIUM: Audience 100–500 OR channel is suboptimal OR festival saturation risk OR regional mismatch OR low-spend segment on premium channel
- HIGH: Audience <100 OR severe channel mismatch OR launching during peak festival blast window without differentiation OR very low spend segment on high-cost channel

Return ONLY the JSON object — no markdown, no code blocks, no explanation.
`.trim();

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    return {
      riskLevel: 'medium',
      riskSummary: 'Unable to fully assess risk. Review your audience size and channel fit before launching.',
      bestTimeToSend: 'Tuesday–Thursday, 7–9 PM IST',
      tips: ['Ensure your message is personalized', 'Double-check the channel fits your audience', 'Monitor delivery rates after launch'],
    };
  }
}
