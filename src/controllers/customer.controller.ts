import type { Context } from 'hono';
import * as customerService from '../services/customer.service.js';

export async function list(c: Context) {
  const page = parseInt(c.req.query('page') ?? '1');
  const limit = parseInt(c.req.query('limit') ?? '20');
  const search = c.req.query('search');

  const result = await customerService.getAllCustomers({ page, limit, search });
  return c.json({ success: true, ...result });
}

export async function getOne(c: Context) {
  const id = c.req.param('id')!;
  const customer = await customerService.getCustomerById(id);
  return c.json({ success: true, data: customer });
}
