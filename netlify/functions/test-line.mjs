import { getStore } from '@netlify/blobs';
import { checkPin, replyJson, sendLine } from './_shared.mjs';

export default async (request) => {
  if (request.method !== 'POST') return replyJson({ error: 'Method not allowed' }, 405);
  let payload;
  try { payload = await request.json(); } catch { return replyJson({ error: 'รูปแบบข้อมูลไม่ถูกต้อง' }, 400); }
  if (!checkPin(payload?.pin)) return replyJson({ error: 'รหัสผ่านไม่ถูกต้อง หรือยังไม่ได้ตั้งรหัสบน Netlify' }, 401);
  try {
    const groupId = await getStore({ name: 'aonoi-line-config', consistency: 'strong' }).get('paired-group');
    if (!groupId) return replyJson({ error: 'ยังไม่ได้เชื่อมกลุ่ม LINE ด้วยคำสั่งเชื่อมรายงาน' }, 409);
    await sendLine(groupId, [{ type: 'text', text: '✅ ทดสอบการแจ้งเตือนจากระบบรายงาน สภ.อ่าวน้อย\nระบบส่งข้อความเข้า LINE ได้สำเร็จ' }]);
    return replyJson({ ok: true, message: 'ส่งข้อความทดสอบเข้า LINE แล้ว' });
  } catch (e) { return replyJson({ error: e.message || 'ส่งไม่สำเร็จ' }, 502); }
};
