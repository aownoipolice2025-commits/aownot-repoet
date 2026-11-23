import test from 'node:test';
import assert from 'node:assert/strict';
import { constantTimeEqual, normalizeReport, checkPin, validateJpegDataUrl } from '../netlify/functions/_shared.mjs';

test('comparison is strict and safe for mismatched lengths', () => {
  assert.equal(constantTimeEqual('abc','abc'), true);
  assert.equal(constantTimeEqual('abc','abcd'), false);
  assert.equal(constantTimeEqual('abC','abc'), false);
});
test('submission requires secret and valid length', () => {
  const original=process.env.REPORT_PIN;
  try {process.env.REPORT_PIN='ABCD1234supersecret';assert.equal(checkPin('ABCD1234supersecret'), true);assert.equal(checkPin('guess'),false);}
  finally {if(original===undefined)delete process.env.REPORT_PIN;else process.env.REPORT_PIN=original;}
});
test('required report fields and input validation', () => {
  const valid={ title:'ตรวจสภาพจราจร', date:'2026-11-23',time:'13:41',place:'ต.อ่าวน้อย',details:'เรียบร้อย',reporter:'เจ้าหน้าที่' };
  assert.equal(normalizeReport(valid)?.title,valid.title);
  assert.equal(normalizeReport({...valid,date:'23/11/2026'}),null);
  assert.equal(normalizeReport({...valid,reporter:''}),null);
  assert.equal(normalizeReport({...valid,title:'a'.repeat(300)}).title.length,160);
});
test('image rejects wrong media types',()=>{
  assert.equal(validateJpegDataUrl('data:image/png;base64,AAAA', 1000),null);
  assert.equal(validateJpegDataUrl('data:image/jpeg;base64,ZZZZ', 1000),null);
});

test('leadership fields are normalized and cannot exceed allowed length', () => {
  const base={ title:'ตรวจพื้นที่', date:'2026-11-23',time:'14:00',place:'ต.อ่าวน้อย',details:'รายงาน',reporter:'ผู้รายงาน' };
  const result=normalizeReport({...base,leaderName:'พ.ต.อ.ชาญยุทธ พวงสั้น',supervisor1Role:'ป'.repeat(300)});
  assert.equal(result.leaderName,'พ.ต.อ.ชาญยุทธ พวงสั้น');
  assert.equal(result.supervisor1Role.length,130);
  assert.equal(result.supervisor2Name,'');
});
