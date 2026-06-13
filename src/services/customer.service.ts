import { db } from '../db/index.js';
import { customers, orders } from '../db/schema.js';
import { eq, ilike, sql, desc } from 'drizzle-orm';
import { AppError } from '../middleware/errorHandler.js';

export async function getAllCustomers(params: {
  page: number;
  limit: number;
  search?: string;
}) {
  const { page, limit, search } = params;
  const offset = (page - 1) * limit;

  const whereClause = search
    ? ilike(customers.name, `%${search}%`)
    : undefined;

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(customers)
      .where(whereClause)
      .orderBy(desc(customers.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(whereClause),
  ]);

  return {
    data: rows,
    pagination: {
      page,
      limit,
      total: countResult[0].count,
      totalPages: Math.ceil(countResult[0].count / limit),
    },
  };
}

export async function getCustomerById(id: string) {
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1);

  if (!customer) throw AppError.notFound(`Customer ${id} not found`);

  const customerOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.customerId, id))
    .orderBy(desc(orders.orderedAt));

  return { ...customer, orders: customerOrders };
}
