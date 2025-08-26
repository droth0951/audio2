const BASE = process.env.EXPO_PUBLIC_CAPTION_PROXY_BASE || 'https://audio-trimmer-service-production.up.railway.app';

type AaiPostResp = { id: string; status: string; [k: string]: any };
type AaiGetResp  = { id: string; status: 'queued'|'processing'|'completed'|'error'; words?: any[]; utterances?: any[]; text?: string; error?: string };

export async function requestTranscript(audioUrl: string, startMs: number, endMs: number): Promise<string> {
  const r = await fetch(`${BASE}/api/transcript`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      audio_url: audioUrl,
      audio_start_from: startMs,
      audio_end_at: endMs,
      punctuate: true,
      format_text: true,
    }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
  const json = (await r.json()) as AaiPostResp;
  if (!json.id) throw new Error('Transcript POST succeeded but no id in response');
  return json.id;
}

export async function pollTranscript(id: string, timeoutMs = 120_000): Promise<AaiGetResp> {
  const started = Date.now();
  const warningThreshold = 120_000; // 2 minutes
  let warningShown = false;
  
  while (true) {
    const elapsed = Date.now() - started;
    
    // Show warning after 2 minutes
    if (elapsed > warningThreshold && !warningShown) {
      console.warn('⚠️ Captioning is taking longer than usual');
      warningShown = true;
    }
    
    const r = await fetch(`${BASE}/api/transcript/${id}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
    const json = (await r.json()) as AaiGetResp;

    if (json.status === 'completed') return json;
    if (json.status === 'error') throw new Error(`AAI error: ${json.error || 'unknown'}`);
    if (elapsed > timeoutMs) throw new Error('Polling timeout');
    await new Promise(res => setTimeout(res, 2000));
  }
}
