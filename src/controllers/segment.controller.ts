import type { Context } from 'hono';
import * as segmentService from '../services/segment.service.js';
import type { SegmentRules } from '../db/schema.js';

export async function list(c: Context) {
  const data = await segmentService.getAllSegments();
  return c.json({ success: true, data });
}

export async function create(c: Context) {
  const body = await c.req.json<{
    name: string;
    description?: string;
    rules: SegmentRules;
  }>();

  const segment = await segmentService.createSegment(body);
  return c.json({ success: true, data: segment }, 201);
}

export async function getOne(c: Context) {
  const id = c.req.param('id')!;
  const segment = await segmentService.getSegmentById(id);
  return c.json({ success: true, data: segment });
}

export async function update(c: Context) {
  const id = c.req.param('id')!;
  const body = await c.req.json<{
    name: string;
    description?: string;
    rules: SegmentRules;
  }>();

  const segment = await segmentService.updateSegment(id, body);
  return c.json({ success: true, data: segment });
}

export async function preview(c: Context) {
  const id = c.req.param('id')!;
  const segment = await segmentService.getSegmentById(id);
  const result = await segmentService.previewSegment(segment.rules as SegmentRules);
  return c.json({ success: true, data: result });
}

export async function previewRules(c: Context) {
  // Preview without saving — for live preview while building segment
  const body = await c.req.json<{ rules: SegmentRules }>();
  const result = await segmentService.previewSegment(body.rules);
  return c.json({ success: true, data: result });
}

export async function remove(c: Context) {
  const id = c.req.param('id')!;
  await segmentService.deleteSegment(id);
  return c.json({ success: true, message: 'Segment deleted' });
}
