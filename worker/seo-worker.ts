/// <reference types="@cloudflare/workers-types" />

/**
 * worker/seo-worker.ts
 *
 * Cloudflare Worker — serves RhemaNotes with dynamic SEO meta tags
 * injected server-side so Google, Facebook, Twitter and WhatsApp crawlers
 * see real metadata without executing JavaScript.
 *
 * Deploy:
 *   npx wrangler deploy worker/seo-worker.ts --name rhemanotes
 *
 * How it works:
 *   1. Fetch the static index.html from the asset binding (your Vite build)
 *   2. Detect the request path to determine which page is being served
 *   3. Build the correct meta tags for that page
 *   4. Use HTMLRewriter to inject them into <head> before sending to client
 *
 * Routes handled:
 *   /              → homepage meta
 *   /history       → history page meta
 *   /note/:id      → dynamic sermon meta (fetched from KV store)
 *   everything else → homepage meta as fallback
 */

import { buildMetaHTML, buildSermonMeta, HOME_META, HISTORY_META } from '../services/seoService';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Env {
  /** Cloudflare Pages / Workers Sites asset binding */
  ASSETS: Fetcher;
  /**
   * KV namespace storing sermon data.
   * Key:   sermon ID (string)
   * Value: JSON string of { title, mainTopic, scriptureCount, timestamp }
   */
  SERMONS_KV?: KVNamespace;
}

interface SermonKVEntry {
  title: string;
  mainTopic: string;
  scriptureCount: number;
  timestamp: number;
}

// ── Worker entry point ────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // 1. Handle robots.txt
    if (path === '/robots.txt') {
      return new Response(generateRobotsTxt(), {
        headers: { 'content-type': 'text/plain' },
      });
    }

    // 2. Handle sitemap.xml
    if (path === '/sitemap.xml') {
      const sitemap = await generateSitemap(env);
      return new Response(sitemap, {
        headers: { 'content-type': 'application/xml' },
      });
    }

    // 3. Pass through non-HTML requests (JS, CSS, images, fonts) unchanged
    if (isAssetRequest(path)) {
      return env.ASSETS.fetch(request);
    }

    // 4. Fetch the base index.html from static assets
    const assetResponse = await env.ASSETS.fetch(
      new Request(`${url.origin}/index.html`, request),
    );

    if (!assetResponse.ok) {
      return assetResponse;
    }

    // 5. Build the correct meta block for this route
    const metaHTML = await resolveMetaHTML(path, env);

    // 6. Inject meta tags into <head> using HTMLRewriter
    // We remove existing title and meta tags to avoid duplication
    return new HTMLRewriter()
      .on('title', { element: (el) => el.remove() })
      .on('meta', {
        element: (el) => {
          const name = el.getAttribute('name');
          const prop = el.getAttribute('property');
          // Remove tags we're about to replace
          if (
            ['description', 'keywords', 'author', 'robots', 'twitter:card', 'twitter:site', 'twitter:title', 'twitter:description', 'twitter:image'].includes(name || '') ||
            (prop && prop.startsWith('og:')) ||
            (prop && prop.startsWith('article:'))
          ) {
            el.remove();
          }
        }
      })
      .on('link[rel="canonical"]', { element: (el) => el.remove() })
      .on('script[type="application/ld+json"]', { element: (el) => el.remove() })
      .on('head', new MetaInjector(metaHTML))
      .transform(assetResponse);
  },
};

// ── Static Assets & Robots ───────────────────────────────────────────────────

function generateRobotsTxt(): string {
  return `User-agent: *
Allow: /
Disallow: /api/
Sitemap: https://rhemanotes.jerlessm.workers.dev/sitemap.xml
`;
}

async function generateSitemap(env: Env): Promise<string> {
  const baseUrl = 'https://rhemanotes.jerlessm.workers.dev';
  const staticRoutes = ['', '/history'];
  
  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  // Add static routes
  for (const route of staticRoutes) {
    sitemap += `
  <url>
    <loc>${baseUrl}${route}</loc>
    <changefreq>daily</changefreq>
    <priority>${route === '' ? '1.0' : '0.8'}</priority>
  </url>`;
  }

  // Add dynamic notes from KV
  if (env.SERMONS_KV) {
    try {
      const list = await env.SERMONS_KV.list();
      for (const key of list.keys) {
        sitemap += `
  <url>
    <loc>${baseUrl}/note/${key.name}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
      }
    } catch (e) {
      console.error('Sitemap KV error:', e);
    }
  }

  sitemap += '\n</urlset>';
  return sitemap;
}

// ── Route → meta resolution ───────────────────────────────────────────────────

async function resolveMetaHTML(path: string, env: Env): Promise<string> {
  // /note/:id  — dynamic sermon page
  const noteMatch = path.match(/^\/note\/([^/]+)/);
  if (noteMatch) {
    const id = noteMatch[1];
    const sermon = await fetchSermonFromKV(id, env);
    if (sermon) {
      return buildMetaHTML(buildSermonMeta({ id, ...sermon }));
    }
    // Sermon not found — serve a generic "note" meta
    return buildMetaHTML({
      title: 'Sermon Note — RhemaNotes',
      description:
        'View this sermon note with scripture references, study tools and personal reflections on RhemaNotes.',
      canonical: `https://rhemanotes.jerlessm.workers.dev/note/${id}`,
      ogType: 'article',
    });
  }

  // /history
  if (path.startsWith('/history')) {
    return buildMetaHTML(HISTORY_META);
  }

  // / and everything else
  return buildMetaHTML(HOME_META);
}

// ── KV lookup ─────────────────────────────────────────────────────────────────

async function fetchSermonFromKV(
  id: string,
  env: Env,
): Promise<SermonKVEntry | null> {
  if (!env.SERMONS_KV) return null;
  try {
    const raw = await env.SERMONS_KV.get(id);
    if (!raw) return null;
    return JSON.parse(raw) as SermonKVEntry;
  } catch {
    return null;
  }
}

// ── HTMLRewriter handler ──────────────────────────────────────────────────────

class MetaInjector {
  private html: string;
  constructor(html: string) { this.html = html; }

  element(element: any): void {
    // Remove the static placeholder tags that index.html already has
    // so we don't end up with duplicate title/description/og tags.
    // We prepend our dynamic block right after <head> opens.
    element.prepend(this.html, { html: true });
  }
}

// ── Asset detection ───────────────────────────────────────────────────────────

const ASSET_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.css', '.png', '.jpg', '.jpeg',
  '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot',
  '.json', '.map', '.webp', '.avif',
]);

function isAssetRequest(path: string): boolean {
  const ext = path.slice(path.lastIndexOf('.'));
  return ASSET_EXTENSIONS.has(ext);
}
