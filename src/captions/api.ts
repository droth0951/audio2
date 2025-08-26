const BASE = process.env.EXPO_PUBLIC_CAPTION_PROXY_BASE || 'https://audio-trimmer-service-production.up.railway.app';
console.log('[captions] EXPO_PUBLIC_CAPTION_PROXY_BASE =', BASE);

export function getProxyBase(): string {
  if (!BASE) {
    throw new Error('EXPO_PUBLIC_CAPTION_PROXY_BASE not configured');
  }
  return BASE.replace(/\/+$/, '');
}

export async function requestTranscriptAPI(payload: any) {
  const base = getProxyBase();
  const res = await fetch(`${base}/api/transcript`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.log('📡 Response status:', res.status, body);
    throw new Error(`HTTP ${res.status}: ${res.statusText} - ${body || 'Not Found'}`);
  }
  return res.json();
}

export async function pollTranscriptAPI(id: string) {
  const base = getProxyBase();
  const res = await fetch(`${base}/api/transcript/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
}
