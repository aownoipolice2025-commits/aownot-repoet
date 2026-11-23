import { getStore } from '@netlify/blobs';
import { createHmac } from 'node:crypto';
import { constantTimeEqual, replyJson } from './_shared.mjs';

export default async (request) => {
  if (request.method !== 'POST') return replyJson({ error: 'Method not allowed' }, 405);
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return replyJson({ error: 'Missing LINE secret' }, 503);
  const raw = await request.text();
  const provided = request.headers.get('x-line-signature') || '';
  const expected = createHmac('sha256', secret).update(raw).digest('base64');
  if (!constantTimeEqual(provided, expected)) return replyJson({ error: 'Invalid signature' }, 401);
  let body;
  try { body = JSON.parse(raw); } catch { return replyJson({ error: 'Invalid JSON' }, 400); }
  const pair = process.env.LINE_PAIR_CODE;
  const events = Array.isArray(body.events) ? body.events : [];
  for (const event of events) {
    if (event.type !== 'message' || event.message?.type !== 'text' || event.source?.type !== 'group') continue;
    const message = (event.message.text || '').trim();
    const match = /^เชื่อมรายงาน\s+(\S+)$/u.exec(message);
    if (!match || !pair || pair.length < 8 || !constantTimeEqual(match[1], pair)) continue;
    const groupId = event.source.groupId;
    if (!/^C[0-9a-f]{32}$/i.test(groupId || '')) continue;
    try {
      const store = getStore({ name: 'aonoi-line-config', consistency: 'strong' });
      await store.set('paired-group', groupId);
      if (event.replyToken && process.env.LINE_CHANNEL_ACCESS_TOKEN) {
        await fetch('https://api.line.me/v2/bot/message/reply', {
          method: 'POST',
          headers: { authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`, 'content-type': 'application/json' },
          body: JSON.stringify({ replyToken: event.replyToken, messages: [{ type: 'text', text: '✅ เชื่อมกลุ่ม LINE กับระบบรายงาน สภ.อ่าวน้อย สำเร็จแล้ว\nพร้อมรับรายงานจากเว็บไซต์' }] }),
          signal: AbortSignal.timeout(10000)
        });
      }
    } catch (error) {
      console.error('LINE pairing error', error);
      return replyJson({ error: 'Storage error' }, 500);
    }
  }
  return replyJson({ ok: true });
};
