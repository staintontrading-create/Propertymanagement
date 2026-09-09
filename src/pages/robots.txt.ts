import type { APIRoute } from 'astro';

/**
 * robots.txt is generated at build time so the sitemap URL always matches the
 * configured `site` and `base` (see astro.config.mjs).
 */
export const GET: APIRoute = ({ site }) => {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, '');
  const sitemap = site ? new URL(`${base}/sitemap-index.xml`, site).toString() : `${base}/sitemap-index.xml`;
  const body = ['User-agent: *', 'Allow: /', '', `Sitemap: ${sitemap}`, ''].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
