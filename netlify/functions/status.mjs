import { getStore } from '@netlify/blobs';
import { configured, replyJson } from './_shared.mjs';

export default async (request) => {
  if (request.method !== 'GET') return replyJson({ error: 'Method not allowed' }, 405);
  const setup = configured();
  let paired = false;
  try { paired = Boolean(await getStore({ name: 'aonoi-line-config', consistency: 'strong' }).get('paired-group')); }
  catch (e) { console.error('Netlify Blobs status:', e.message); }
  return replyJson({ ok: true, ready: setup.pin && setup.line && setup.pairCode && paired,
    setup: { reportPassword: setup.pin, messagingApi: setup.line, pairingCode: setup.pairCode, groupConnected: paired } });
};
