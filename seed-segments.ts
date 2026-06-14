import { db } from './src/db/index.js';
import { createSegment } from './src/services/segment.service.js';

async function run() {
  const segments = [
    {
      name: "High Value Whales 🐋",
      description: "VIP customers who have spent more than ₹25,000",
      rules: {
        operator: "AND",
        conditions: [
          { field: "total_spend", op: "gt", value: 25000 }
        ]
      }
    },
    {
      name: "Churn Risk (60 Days) ⚠️",
      description: "Haven't ordered in the last 60 days but are repeat buyers",
      rules: {
        operator: "AND",
        conditions: [
          { field: "last_order_at", op: "gt", value: "60d" },
          { field: "order_count", op: "gt", value: 1 }
        ]
      }
    },
    {
      name: "Frequent Electronics Buyers 💻",
      description: "More than 5 orders in the Electronics category",
      rules: {
        operator: "AND",
        conditions: [
          { field: "order_count", op: "gt", value: 5 },
          { field: "favourite_category", op: "eq", value: "Electronics" }
        ]
      }
    },
    {
      name: "Top Metros Engagement 🏙️",
      description: "Shoppers located in Mumbai, Delhi, or Bangalore",
      rules: {
        operator: "OR",
        conditions: [
          { field: "city", op: "eq", value: "Mumbai" },
          { field: "city", op: "eq", value: "Delhi" },
          { field: "city", op: "eq", value: "Bangalore" }
        ]
      }
    },
    {
      name: "One-Time Buyers (Needs Nudge) 🎯",
      description: "Customers who only bought once and spent less than ₹2000",
      rules: {
        operator: "AND",
        conditions: [
          { field: "order_count", op: "eq", value: 1 },
          { field: "total_spend", op: "lt", value: 2000 }
        ]
      }
    }
  ];

  for (const seg of segments) {
    try {
      await createSegment(seg as any);
      console.log("Created:", seg.name);
    } catch(e: any) {
      console.error("Failed to create", seg.name, e.message);
    }
  }
  process.exit(0);
}

run();
