import { getStore } from '@netlify/blobs';

export default async (request) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
  const url = new URL(request.url);
  const id = url.searchParams.get('id') || '';
  const kind = url.searchParams.get('kind') === 'thumb' ? 'thumb' : 'full';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('Invalid image ID', { status: 400 });
  try {
    const item = await getStore('aonoi-report-images').get(`${id}/${kind}`, { type: 'arrayBuffer' });
    if (!item) return new Response('Image not found', { status: 404 });
    return new Response(request.method === 'HEAD' ? null : item, {
      status: 200,
      headers: {
        'content-type': 'image/jpeg',
        'cache-control': 'public, max-age=3600',
        'x-content-type-options': 'nosniff',
        'content-length': String(item.byteLength)
      }
    });
  } catch (error) {
    console.error('Image load error:', error);
    return new Response('Storage unavailable', { status: 503 });
  }
};
