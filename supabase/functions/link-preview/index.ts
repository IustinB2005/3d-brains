// Supabase Edge Function: fetches title + preview image for a model link
// (Printables, MakerWorld, Thingiverse, Cults3D, Thangs).
// Deploy:  supabase functions deploy link-preview
// Only signed-in users can call it (Supabase verifies the JWT by default).

const ALLOWED = ['printables.com', 'makerworld.com', 'makerworld.com.cn', 'thingiverse.com', 'cults3d.com', 'thangs.com'];

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

function meta(html: string, prop: string) {
  const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, 'i');
  return decode((html.match(re1) || html.match(re2) || [])[1] || '').trim();
}

function cleanTitle(t: string) {
  return t
    .split(/\s+\|\s+/)[0]
    .replace(/\s+[-–]\s+(Free\s+)?3D\s+(Print(able)?\s+)?Model.*$/i, '')
    .replace(/\s+[-–]\s+MakerWorld$/i, '')
    .replace(/\s+by\s+[^|]+$/i, '')
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { url } = await req.json();
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (u.protocol !== 'https:' || !ALLOWED.some((d) => host === d || host.endsWith('.' + d))) {
      return json({ error: 'Host not supported' }, 400);
    }
    const res = await fetch(u.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; 3DBrainsBot/1.0; +https://3dbrains.ro)',
        Accept: 'text/html',
        'Accept-Language': 'en',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return json({ title: '', image: '', status: res.status });
    const html = (await res.text()).slice(0, 600_000);
    const rawTitle = meta(html, 'og:title') || meta(html, 'twitter:title') || (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '';
    const image = meta(html, 'og:image') || meta(html, 'twitter:image');
    return json({ title: cleanTitle(decode(rawTitle)), image: image.startsWith('https://') ? image : '' });
  } catch (e) {
    return json({ error: String(e) }, 400);
  }
});
