/**
 * youtubeService.ts
 *
 * Extracts a real transcript + title from a YouTube URL.
 *
 * Proxy waterfall (each tried in order, first success wins):
 *   1. corsproxy.io        — raw text, no compression issues
 *   2. codetabs.com        — raw text, different infrastructure
 *   3. allorigins.win      — JSON wrapper, force identity encoding to avoid
 *                            the net::ERR_HTTP2_PROTOCOL_ERROR caused by
 *                            Cloudflare's zstd compression on large payloads
 *
 * Caption XML is fetched directly (no proxy) since YouTube's timedtext
 * endpoint allows cross-origin reads on its signed URLs.
 */

export interface YouTubeResult {
  title: string;
  transcript: string;
  videoId: string;
}

// ── Video ID extraction ───────────────────────────────────────────────────────

export function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (u.searchParams.has('v')) return u.searchParams.get('v');
    const m = u.pathname.match(/\/(embed|shorts|v)\/([^/?&]+)/);
    if (m) return m[2];
    return null;
  } catch {
    return null;
  }
}

// ── Proxy definitions ─────────────────────────────────────────────────────────

interface ProxyResult {
  text: string;
}

type ProxyFn = (targetUrl: string) => Promise<ProxyResult>;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * allorigins.win — JSON wrapper { contents, status }.
 * Most permissive for YouTube-sized pages.
 * Force identity encoding to avoid Cloudflare zstd H2 stream errors.
 */
const tryAllorigins: ProxyFn = async (targetUrl) => {
  const bust = Date.now();
  const res = await fetch(
    `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}&_=${bust}`,
    {
      headers: {
        'Accept': '*/*',
        'Accept-Encoding': 'identity',
      },
    },
  );
  if (res.status === 429) throw new Error('allorigins rate limited (429)');
  if (!res.ok) throw new Error(`allorigins returned ${res.status}`);
  const text = await res.text();
  if (!text?.trim()) throw new Error('allorigins returned empty contents');
  return { text };
};

/**
 * codetabs.com — raw text response, different infrastructure.
 */
const tryCodetabs: ProxyFn = async (targetUrl) => {
  const res = await fetch(
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
    {
      headers: {
        'Accept': '*/*',
        'Accept-Encoding': 'identity',
      },
    },
  );
  if (res.status === 429) throw new Error('codetabs rate limited (429)');
  if (!res.ok) throw new Error(`codetabs returned ${res.status}`);
  const text = await res.text();
  if (!text?.trim()) throw new Error('codetabs returned empty body');
  return { text };
};

/**
 * corsproxy.io — raw text, no Cloudflare.
 * Kept as last resort since it rate-limits aggressively on free tier.
 */
const tryCorsproxy: ProxyFn = async (targetUrl) => {
  const res = await fetch(
    `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
    {
      headers: {
        'Accept': '*/*',
        'Accept-Encoding': 'identity',
      },
    },
  );
  if (res.status === 429) throw new Error('corsproxy.io rate limited (429)');
  if (!res.ok) throw new Error(`corsproxy.io returned ${res.status}`);
  const text = await res.text();
  if (!text?.trim()) throw new Error('corsproxy.io returned empty body');
  return { text };
};

// Try codetabs first as it's currently most reliable, then corsproxy, then allorigins (which has HTTP2 issues)
const PROXY_CHAIN: ProxyFn[] = [tryCodetabs, tryCorsproxy, tryAllorigins];

async function proxyFetch(targetUrl: string): Promise<string> {
  const errors: string[] = [];

  for (let i = 0; i < PROXY_CHAIN.length; i++) {
    if (i > 0) await sleep(600); // brief pause before trying next proxy
    try {
      const { text } = await PROXY_CHAIN[i](targetUrl);
      return text;
    } catch (e: any) {
      errors.push(e?.message ?? String(e));
    }
  }

  throw new Error(
    `All proxies failed.\n${errors.join(' | ')}`,
  );
}

// ── Caption track parsing ─────────────────────────────────────────────────────

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string; // "asr" = auto-generated
  name: string;
}

function parseCaptionTracks(html: string): CaptionTrack[] {
  const match = html.match(/"captionTracks":(\[.*?\])/);
  if (!match) return [];
  try {
    const raw = match[1]
      .replace(/\\u0026/g, '&')
      .replace(/\\u003d/g, '=');
    const tracks: any[] = JSON.parse(raw);
    return tracks.map(t => ({
      baseUrl: t.baseUrl,
      languageCode: t.languageCode ?? '',
      kind: t.kind,
      name: t.name?.simpleText ?? t.name?.runs?.[0]?.text ?? '',
    }));
  } catch {
    return [];
  }
}

function pickBestTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  if (!tracks.length) return null;
  // Manual English > auto-generated English > any language
  return (
    tracks.find(t => t.languageCode.startsWith('en') && t.kind !== 'asr') ??
    tracks.find(t => t.languageCode.startsWith('en')) ??
    tracks[0]
  );
}

// ── Caption XML → plain text ──────────────────────────────────────────────────

function xmlToPlainText(xml: string): string {
  return xml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Title extraction ──────────────────────────────────────────────────────────

function parseTitle(html: string): string {
  // og:title is the most reliable — it's the exact video title
  const og = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/);
  if (og) return decodeHTMLEntities(og[1]);

  const title = html.match(/<title>([^<]+)<\/title>/);
  if (title) return title[1].replace(/ - YouTube$/, '').trim();

  return 'YouTube Sermon';
}

function decodeHTMLEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// ── Caption XML fetch ─────────────────────────────────────────────────────────

async function fetchCaptionXml(baseUrl: string): Promise<string> {
  // YouTube's timedtext signed URLs often allow direct browser fetches.
  // Try direct first (fastest, no proxy overhead).
  try {
    const res = await fetch(baseUrl, {
      headers: { 'Accept-Encoding': 'identity' },
    });
    if (res.ok) {
      const text = await res.text();
      if (text?.trim()) return text;
    }
  } catch {
    // fall through to proxy
  }

  // Direct fetch blocked by CORS — use proxy chain
  return proxyFetch(baseUrl);
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function getYouTubeTranscript(url: string): Promise<YouTubeResult> {
  const videoId = extractVideoId(url);
  if (!videoId) {
    throw new Error(
      "That doesn't look like a valid YouTube URL. " +
      'Try https://www.youtube.com/watch?v=… or https://youtu.be/…',
    );
  }

  // ── Step 1: fetch the YouTube watch page ──
  let html: string;
  try {
    html = await proxyFetch(`https://www.youtube.com/watch?v=${videoId}`);
  } catch (e: any) {
    throw new Error(
      'Could not load the YouTube page. ' +
      'Check your internet connection and try again.\n' +
      (e?.message ?? ''),
    );
  }

  // ── Step 2: extract title ──
  const title = parseTitle(html);

  // ── Step 3: find caption tracks ──
  const tracks = parseCaptionTracks(html);
  if (!tracks.length) {
    throw new Error(
      'No captions found for this video. ' +
      'The channel may have disabled transcripts, or the video is private or age-restricted. ' +
      'Try uploading the audio file directly instead.',
    );
  }

  const track = pickBestTrack(tracks);
  if (!track) throw new Error('Could not select a caption track.');

  // ── Step 4: fetch caption XML ──
  let xml: string;
  try {
    xml = await fetchCaptionXml(track.baseUrl);
  } catch {
    throw new Error(
      'Found captions but could not download them. Please try again.',
    );
  }

  // ── Step 5: convert to plain text ──
  const transcript = xmlToPlainText(xml);
  if (!transcript) {
    throw new Error(
      'The transcript came back empty. This video may not have usable captions.',
    );
  }

  return { title, transcript, videoId };
}
