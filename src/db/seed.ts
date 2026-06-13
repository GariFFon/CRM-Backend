import 'dotenv/config';
import { faker } from '@faker-js/faker';
import { db } from './index.js';
import {
  customers,
  orders,
  type NewCustomer,
  type NewOrder,
  type OrderItem,
} from './schema.js';

// ─── Config ───────────────────────────────────────────────────────────────────
const CUSTOMER_COUNT = 600;
const CATEGORIES = ['shoes', 'clothing', 'accessories', 'electronics', 'home'];
const INDIAN_CITIES = [
  'Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Chennai',
  'Pune', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Surat',
  'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Bhopal',
];

const PRODUCT_NAMES: Record<string, string[]> = {
  shoes: ['Running Shoes', 'Casual Sneakers', 'Formal Oxfords', 'Sandals', 'Sports Shoes', 'Loafers'],
  clothing: ['Cotton T-Shirt', 'Denim Jeans', 'Kurta', 'Formal Shirt', 'Hoodie', 'Track Pants'],
  accessories: ['Leather Wallet', 'Sunglasses', 'Belt', 'Watch', 'Cap', 'Backpack'],
  electronics: ['Earphones', 'Phone Case', 'Power Bank', 'USB Cable', 'Smart Band'],
  home: ['Cushion Cover', 'Table Lamp', 'Wall Art', 'Candle Set', 'Photo Frame'],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randomIndianPhone(): string {
  const prefixes = ['91', '92', '93', '94', '95', '96', '97', '98', '99', '70', '80'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const rest = Math.floor(Math.random() * 90000000 + 10000000).toString();
  return `+91${prefix}${rest}`;
}

function randomCategory(): string {
  return CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
}

function generateOrderItems(primaryCategory: string): OrderItem[] {
  const count = Math.floor(Math.random() * 3) + 1;
  const items: OrderItem[] = [];

  for (let i = 0; i < count; i++) {
    // 60% chance of sticking to primary category
    const cat = Math.random() < 0.6 ? primaryCategory : randomCategory();
    const productList = PRODUCT_NAMES[cat];
    const name = productList[Math.floor(Math.random() * productList.length)];

    let price: number;
    switch (cat) {
      case 'electronics': price = faker.number.int({ min: 299, max: 4999 }); break;
      case 'shoes': price = faker.number.int({ min: 499, max: 8999 }); break;
      case 'clothing': price = faker.number.int({ min: 299, max: 3999 }); break;
      case 'accessories': price = faker.number.int({ min: 199, max: 5999 }); break;
      default: price = faker.number.int({ min: 199, max: 2999 });
    }

    items.push({ name, category: cat, price, qty: 1 });
  }

  return items;
}

// ─── Main Seed Function ───────────────────────────────────────────────────────

async function seed() {
  console.log('🌱 Starting database seed...');
  console.log(`📊 Generating ${CUSTOMER_COUNT} customers...`);

  // Clear existing data
  console.log('🗑️  Clearing existing data...');
  await db.delete(orders);
  await db.delete(customers);

  const customerBatch: NewCustomer[] = [];
  const orderBatch: NewOrder[] = [];

  for (let i = 0; i < CUSTOMER_COUNT; i++) {
    const customerId = crypto.randomUUID();
    const favouriteCategory = randomCategory();
    const city = INDIAN_CITIES[Math.floor(Math.random() * INDIAN_CITIES.length)];

    // Random join date: 6 months to 2 years ago
    const createdAt = faker.date.past({ years: 2 });

    // How many orders this customer has (0–8)
    // 20% of customers are inactive (0 orders or last ordered long ago)
    const orderCount = faker.number.int({ min: 0, max: 8 });

    let totalSpend = 0;
    let lastOrderAt: Date | null = null;
    const customerOrders: NewOrder[] = [];

    for (let j = 0; j < orderCount; j++) {
      const orderId = crypto.randomUUID();
      const items = generateOrderItems(favouriteCategory);
      const amount = items.reduce((sum, item) => sum + item.price * item.qty, 0);
      const orderedAt = faker.date.between({ from: createdAt, to: new Date() });

      totalSpend += amount;
      if (!lastOrderAt || orderedAt > lastOrderAt) {
        lastOrderAt = orderedAt;
      }

      customerOrders.push({
        id: orderId,
        customerId,
        amount: amount.toFixed(2),
        items: items as any,
        orderedAt,
      });
    }

    // For some customers, push last order date way back (inactive segment)
    // 25% of customers haven't ordered in 90+ days
    if (orderCount > 0 && Math.random() < 0.25 && lastOrderAt) {
      const daysBack = faker.number.int({ min: 90, max: 365 });
      lastOrderAt = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
      // Update the last order's date
      if (customerOrders.length > 0) {
        customerOrders[customerOrders.length - 1].orderedAt = lastOrderAt;
      }
    }

    const avgOrderValue = orderCount > 0 ? totalSpend / orderCount : 0;

    customerBatch.push({
      id: customerId,
      name: faker.person.fullName(),
      email: faker.internet.email().toLowerCase(),
      phone: randomIndianPhone(),
      city,
      totalSpend: totalSpend.toFixed(2),
      orderCount,
      avgOrderValue: avgOrderValue.toFixed(2),
      lastOrderAt: lastOrderAt ?? undefined,
      favouriteCategory,
      createdAt,
    });

    orderBatch.push(...customerOrders);
  }

  // Insert in batches of 100
  console.log('👤 Inserting customers...');
  for (let i = 0; i < customerBatch.length; i += 100) {
    await db.insert(customers).values(customerBatch.slice(i, i + 100));
    process.stdout.write(`\r  Progress: ${Math.min(i + 100, customerBatch.length)}/${customerBatch.length}`);
  }
  console.log('\n✅ Customers inserted');

  console.log('📦 Inserting orders...');
  for (let i = 0; i < orderBatch.length; i += 100) {
    await db.insert(orders).values(orderBatch.slice(i, i + 100));
    process.stdout.write(`\r  Progress: ${Math.min(i + 100, orderBatch.length)}/${orderBatch.length}`);
  }
  console.log('\n✅ Orders inserted');

  console.log(`\n🎉 Seed complete!`);
  console.log(`   Customers: ${customerBatch.length}`);
  console.log(`   Orders:    ${orderBatch.length}`);
  console.log(`   Avg orders per customer: ${(orderBatch.length / customerBatch.length).toFixed(1)}`);

  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
