import { getStore } from '@netlify/blobs';
import { randomUUID } from 'node:crypto';
import { checkPin, normalizeReport, replyJson, sendLine, validateJpegDataUrl } from './_shared.mjs';

export default async (request) => {
  if (request.method !== 'POST') return replyJson({ error: 'Method not allowed' }, 405);
  if (Number(request.headers.get('content-length') || 0) > 4_000_000) return replyJson({ error: 'ไฟล์รายงานใหญ่เกินไป' }, 413);
  let data;
  try { data = await request.json(); } catch { return replyJson({ error: 'ข้อมูล JSON ไม่ถูกต้อง' }, 400); }
  if (!checkPin(data?.pin)) return replyJson({ error: 'รหัสผ่านไม่ถูกต้อง หรือยังไม่ได้ตั้งค่าบน Netlify' }, 401);
  const report = normalizeReport(data?.report);
  if (!report) return replyJson({ error: 'กรอกข้อมูลสำคัญให้ครบ (หัวข้อ วัน เวลา สถานที่ รายละเอียด ผู้รายงาน)' }, 400);
  const full = validateJpegDataUrl(data.imageFull, 2_500_000);
  const thumb = validateJpegDataUrl(data.imagePreview, 300_000);
  if (!full || !thumb) return replyJson({ error: 'ไฟล์ภาพต้องเป็น JPEG ขนาดไม่เกินที่กำหนด กรุณาลองดาวน์โหลดภาพใหม่' }, 400);
  const groupId = await getStore({ name: 'aonoi-line-config', consistency: 'strong' }).get('paired-group').catch(() => null);
  if (!groupId) return replyJson({ error: 'ยังไม่เชื่อมกลุ่ม LINE กรุณาดูคู่มือการติดตั้ง' }, 409);
  const id = randomUUID();
  try {
    const images = getStore('aonoi-report-images');
    await Promise.all([
      images.set(`${id}/full`, full.buffer.slice(full.byteOffset, full.byteOffset + full.byteLength), { metadata: { uploaded: new Date().toISOString() } }),
      images.set(`${id}/thumb`, thumb.buffer.slice(thumb.byteOffset, thumb.byteOffset + thumb.byteLength), { metadata: { uploaded: new Date().toISOString() } })
    ]);
    const root = (process.env.URL || new URL(request.url).origin).replace(/\/$/, '');
    const urlFull = `${root}/.netlify/functions/report-image?id=${id}&kind=full`;
    const urlThumb = `${root}/.netlify/functions/report-image?id=${id}&kind=thumb`;
    const supervisors = [
      report.leaderName ? `ผกก.: ${report.leaderName} (${report.leaderRole || 'ไม่ระบุตำแหน่ง'})` : '',
      report.supervisor1Name ? `ผู้บังคับบัญชา 1: ${report.supervisor1Name} (${report.supervisor1Role || 'ไม่ระบุตำแหน่ง'})` : '',
      report.supervisor2Name ? `ผู้บังคับบัญชา 2: ${report.supervisor2Name} (${report.supervisor2Role || 'ไม่ระบุตำแหน่ง'})` : ''
    ].filter(Boolean).join('\n');
    const text = `🚨 รายงานการปฏิบัติราชการ\n${report.station || 'สภ.อ่าวน้อย'}\n\n📌 ${report.category || 'งานทั่วไป'}\n${report.title}\n📅 ${report.date} เวลา ${report.time} น.\n📍 ${report.place}\n👮 ผู้รายงาน: ${report.reporter}\n\n${supervisors ? 'ผู้บังคับบัญชา\n' + supervisors + '\n\n' : ''}รายละเอียด: ${report.details.slice(0, 450)}${report.details.length > 450 ? '…' : ''}\n\n🖼 ภาพรายงานแนบด้านล่าง`;
    await sendLine(groupId, [
      { type: 'text', text: text.slice(0, 1900) },
      { type: 'image', originalContentUrl: urlFull, previewImageUrl: urlThumb }
    ]);
    return replyJson({ ok: true, message: 'ส่งรายงานและรูปภาพเข้า LINE สำเร็จ', id, imageUrl: urlFull });
  } catch (error) {
    console.error('Submit error:', error);
    return replyJson({ error: error.message || 'ส่งรายงานไม่สำเร็จ' }, 502);
  }
};
