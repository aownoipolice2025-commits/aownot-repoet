import { timingSafeEqual } from 'node:crypto';

export function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aa = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (aa.length !== bb.length) return false;
  return timingSafeEqual(aa, bb);
}
export function replyJson(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status, headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
}
export function configured() {
  return {
    pin: typeof process.env.REPORT_PIN === 'string' && process.env.REPORT_PIN.length >= 8,
    line: Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_CHANNEL_SECRET),
    pairCode: typeof process.env.LINE_PAIR_CODE === 'string' && process.env.LINE_PAIR_CODE.length >= 8
  };
}
export function checkPin(pin) {
  return configured().pin && constantTimeEqual(pin, process.env.REPORT_PIN);
}
export async function sendLine(to, messages) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error('ยังไม่ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN');
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ to, messages }),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 450);
    console.error('LINE push failed:', response.status, detail);
    throw new Error(`LINE ส่งไม่สำเร็จ (${response.status}) ตรวจสอบ Token สิทธิ์เข้ากลุ่ม และโควตา`);
  }
}
export function validateJpegDataUrl(dataUrl, maxBytes) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/jpeg;base64,')) return null;
  const b64 = dataUrl.slice('data:image/jpeg;base64,'.length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64) || b64.length > Math.ceil(maxBytes * 4 / 3) + 8) return null;
  const buffer = Buffer.from(b64, 'base64');
  if (buffer.length < 100 || buffer.length > maxBytes || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer.at(-2) !== 0xff || buffer.at(-1) !== 0xd9) return null;
  return buffer;
}
export function normalizeReport(r) {
  const str = (v, n) => typeof v === 'string' ? v.trim().slice(0, n) : '';
  if (!r || typeof r !== 'object') return null;
  const report = {
    station: str(r.station, 100), province: str(r.province, 100),
    category: str(r.category, 70), title: str(r.title, 160),
    date: str(r.date, 20), time: str(r.time, 10),
    place: str(r.place, 180), details: str(r.details, 900),
    result: str(r.result, 500), reporter: str(r.reporter, 150),
    commander: str(r.commander, 150), phone: str(r.phone, 40),
    leaderName: str(r.leaderName, 120), leaderRole: str(r.leaderRole, 130),
    supervisor1Name: str(r.supervisor1Name, 120), supervisor1Role: str(r.supervisor1Role, 130),
    supervisor2Name: str(r.supervisor2Name, 120), supervisor2Role: str(r.supervisor2Role, 130)
  };
  if (!report.title || !report.date || !report.time || !report.place || !report.details || !report.reporter) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(report.date) || !/^\d{2}:\d{2}$/.test(report.time)) return null;
  return report;
}
