import { db } from '../db/index.js';
import { customers, segments, type SegmentRules, type SegmentCondition } from '../db/schema.js';
import { eq, sql, desc } from 'drizzle-orm';
import { AppError } from '../middleware/errorHandler.js';

// ─── Rule Engine ─────────────────────────────────────────────────────────────

/**
 * Converts a SegmentRules JSON object into a SQL WHERE clause.
 * Supports AND/OR operators and all defined field types.
 */
function buildWhereClause(rules: SegmentRules): string {
  const clauses = rules.conditions.map((cond: SegmentCondition) => {
    const { field, op, value } = cond;

    // Date fields: value is like "90d", "30d", "1y"
    if (field === 'last_order_at') {
      const interval = parseDateInterval(value as string);
      const sqlOp = op === 'gt' || op === 'gte' ? '<' : '>';
      return `last_order_at ${sqlOp} NOW() - INTERVAL '${interval}'`;
    }

    // Numeric fields
    if (field === 'total_spend' || field === 'order_count' || field === 'avg_order_value') {
      const sqlOp = opToSql(op);
      const numVal = typeof value === 'string' ? parseFloat(value) : value;
      return `${field} ${sqlOp} ${numVal}`;
    }

    // String equality fields
    if (field === 'favourite_category' || field === 'city') {
      if (op === 'eq') return `${field} = '${sanitize(value as string)}'`;
      if (op === 'neq') return `${field} != '${sanitize(value as string)}'`;
      if (op === 'in') {
        const vals = (value as string[]).map((v) => `'${sanitize(v)}'`).join(', ');
        return `${field} IN (${vals})`;
      }
    }

    return '1=1'; // fallback — match all
  });

  const joiner = rules.operator === 'AND' ? ' AND ' : ' OR ';
  return clauses.length > 0 ? clauses.join(joiner) : '1=1';
}

function parseDateInterval(val: string): string {
  const map: Record<string, string> = {
    '7d': '7 days', '14d': '14 days', '30d': '30 days',
    '60d': '60 days', '90d': '90 days', '180d': '180 days', '1y': '1 year',
  };
  return map[val] ?? '90 days';
}

function opToSql(op: string): string {
  const map: Record<string, string> = {
    lt: '<', lte: '<=', gt: '>', gte: '>=', eq: '=', neq: '!=',
  };
  return map[op] ?? '=';
}

function sanitize(val: string): string {
  return val.replace(/'/g, "''"); // basic SQL injection prevention
}

// ─── Run preview query ────────────────────────────────────────────────────────

export async function previewSegment(rules: SegmentRules): Promise<{
  count: number;
  samples: Array<{ id: string; name: string; email: string; city: string }>;
}> {
  const whereClause = buildWhereClause(rules);

  const [countResult, samples] = await Promise.all([
    db.execute(sql.raw(`SELECT COUNT(*)::int AS count FROM customers WHERE ${whereClause}`)),
    db.execute(sql.raw(
      `SELECT id, name, email, city FROM customers WHERE ${whereClause} ORDER BY created_at DESC LIMIT 5`
    )),
  ]);

  return {
    count: (countResult as any)[0]?.count ?? 0,
    samples: samples as any,
  };
}

// ─── Get matching customer IDs (for campaign launch) ─────────────────────────

export async function getMatchingCustomerIds(rules: SegmentRules): Promise<string[]> {
  const whereClause = buildWhereClause(rules);
  const result = await db.execute(
    sql.raw(`SELECT id FROM customers WHERE ${whereClause}`)
  );
  return (result as any[]).map((r) => r.id);
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function createSegment(data: {
  name: string;
  description?: string;
  rules: SegmentRules;
}) {
  const preview = await previewSegment(data.rules);

  const [segment] = await db
    .insert(segments)
    .values({
      name: data.name,
      description: data.description,
      rules: data.rules as any,
      customerCount: preview.count,
    })
    .returning();

  return segment;
}

export async function updateSegment(id: string, data: {
  name: string;
  description?: string;
  rules: SegmentRules;
}) {
  await getSegmentById(id); // ensure exists
  const preview = await previewSegment(data.rules);

  const [segment] = await db
    .update(segments)
    .set({
      name: data.name,
      description: data.description,
      rules: data.rules as any,
      customerCount: preview.count,
    })
    .where(eq(segments.id, id))
    .returning();

  return segment;
}

export async function getAllSegments() {
  return db.select().from(segments).orderBy(desc(segments.createdAt));
}

export async function getSegmentById(id: string) {
  const [segment] = await db
    .select()
    .from(segments)
    .where(eq(segments.id, id))
    .limit(1);

  if (!segment) throw AppError.notFound(`Segment ${id} not found`);
  return segment;
}

export async function deleteSegment(id: string) {
  await getSegmentById(id); // ensure exists
  await db.delete(segments).where(eq(segments.id, id));
}
