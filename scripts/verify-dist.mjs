#!/usr/bin/env node
/**
 * Post-build verification for the static output in dist/.
 *
 * Checks every generated HTML page for:
 *   - internal links, images, scripts and stylesheets that resolve to a file
 *     in dist/ (respecting the configured base path and trailing slashes)
 *   - fragment links (#id) that point at an element that exists on the target
 *   - one <h1>, a non-empty unique <title>, a non-empty unique meta
 *     description, a canonical link and a lang attribute
 *   - alt attributes on every <img>, no duplicate ids, no skipped heading levels
 *   - leftover template artefacts ("{{", "undefined", "[object Object]", "TODO",
 *     "lorem ipsum")
 * and that sitemap-index.xml, sitemap-0.xml and robots.txt exist and cover
 * every page except the 404.
 *
 * Exits non-zero when any error is found. No dependencies beyond Node.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../astro.config.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, 'dist');
const base = (config.base ?? '/').replace(/\/+$/, ''); // '' for root, '/repo' for project sites
const site = config.site ? new URL(config.site) : null;

const errors = [];
const warnings = [];
const error = (page, msg) => errors.push(`${page}: ${msg}`);
const warn = (page, msg) => warnings.push(`${page}: ${msg}`);

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

async function exists(file) {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

const ATTR_RE = /([\w:.-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
function parseAttrs(raw) {
  const attrs = {};
  for (const m of raw.matchAll(ATTR_RE)) attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  return attrs;
}

function decode(s) {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

/** All tags as {name, attrs} in document order, with script/style bodies removed. */
function tags(html) {
  const stripped = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '<script></script>').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '<style></style>');
  const list = [];
  for (const m of stripped.matchAll(/<([a-zA-Z][\w:-]*)\b([^>]*)>/g)) list.push({ name: m[1].toLowerCase(), attrs: parseAttrs(m[2]) });
  return list;
}

function textOnly(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
}

const htmlFiles = (await walk(dist)).filter((f) => f.endsWith('.html'));
if (htmlFiles.length === 0) {
  console.error('No HTML files found in dist/. Run `npm run build` first.');
  process.exit(1);
}

const pages = new Map(); // route -> { file, html, ids }
for (const file of htmlFiles) {
  const rel = path.relative(dist, file).split(path.sep).join('/');
  const route = rel.endsWith('index.html') ? `${base}/${rel.slice(0, -'index.html'.length)}` : `${base}/${rel}`;
  const html = await readFile(file, 'utf8');
  const ids = new Set();
  const dupIds = new Set();
  for (const t of tags(html)) {
    if (t.attrs.id !== undefined) {
      if (ids.has(t.attrs.id)) dupIds.add(t.attrs.id);
      ids.add(t.attrs.id);
    }
  }
  pages.set(route, { file, html, ids, dupIds, rel });
}

const pendingChecks = [];
const existsCache = new Map();
function existsSync(file) {
  if (!existsCache.has(file)) existsCache.set(file, exists(file));
  const p = existsCache.get(file);
  pendingChecks.push(p);
  return p;
}

const titles = new Map();
const descriptions = new Map();

for (const [route, page] of pages) {
  const { html, dupIds, rel } = page;
  const is404 = rel === '404.html';
  const all = tags(html);

  const htmlTag = all.find((t) => t.name === 'html');
  if (!htmlTag?.attrs.lang) error(rel, 'missing <html lang>');

  const h1s = all.filter((t) => t.name === 'h1');
  if (h1s.length !== 1) error(rel, `expected exactly one <h1>, found ${h1s.length}`);

  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decode(titleMatch[1]).trim() : '';
  if (!title) error(rel, 'missing or empty <title>');
  else if (titles.has(title) && !is404) error(rel, `duplicate <title> "${title}" (also on ${titles.get(title)})`);
  else titles.set(title, rel);
  if (title.length > 70) warn(rel, `<title> is ${title.length} characters; keep under 70 for search results`);

  const desc = all.find((t) => t.name === 'meta' && t.attrs.name === 'description')?.attrs.content ?? '';
  if (!desc.trim()) error(rel, 'missing meta description');
  else if (descriptions.has(desc) && !is404) error(rel, `duplicate meta description (also on ${descriptions.get(desc)})`);
  else descriptions.set(desc, rel);
  if (desc.length > 165) warn(rel, `meta description is ${desc.length} characters; keep under 165`);

  if (!all.some((t) => t.name === 'link' && t.attrs.rel === 'canonical')) error(rel, 'missing canonical link');

  for (const id of dupIds) error(rel, `duplicate id="${id}"`);

  let lastLevel = 0;
  for (const t of all) {
    const m = t.name.match(/^h([1-6])$/);
    if (!m) continue;
    const level = Number(m[1]);
    if (lastLevel && level > lastLevel + 1) error(rel, `heading level skips from h${lastLevel} to h${level}`);
    lastLevel = level;
  }

  for (const t of all) {
    if (t.name === 'img' && t.attrs.alt === undefined) error(rel, `<img src="${t.attrs.src}"> has no alt attribute`);
    if (t.name === 'a' && t.attrs.href === undefined) error(rel, '<a> without href');
    if (t.name === 'a' && t.attrs.target === '_blank' && !/noopener/.test(t.attrs.rel ?? '')) warn(rel, `<a href="${t.attrs.href}" target="_blank"> without rel="noopener"`);
  }

  const text = textOnly(html);
  for (const [re, label] of [
    [/\{\{|\}\}/, 'template braces "{{"'],
    [/\bundefined\b/, '"undefined"'],
    [/\[object Object\]/, '"[object Object]"'],
    [/\bNaN\b/, '"NaN"'],
    [/\bTODO\b|\bFIXME\b/, 'TODO/FIXME marker'],
    [/lorem ipsum/i, 'lorem ipsum'],
  ]) {
    if (re.test(text)) error(rel, `page text contains ${label}`);
  }

  // Links and assets
  const refs = [];
  for (const t of all) {
    if (t.attrs.href !== undefined && ['a', 'link', 'area'].includes(t.name)) refs.push({ kind: t.name, url: t.attrs.href });
    if (t.attrs.src !== undefined) refs.push({ kind: t.name, url: t.attrs.src });
    if (t.attrs.srcset) for (const part of t.attrs.srcset.split(',')) refs.push({ kind: `${t.name} srcset`, url: part.trim().split(/\s+/)[0] });
    if (t.name === 'meta' && (t.attrs.property === 'og:url' || t.attrs.property === 'og:image') && t.attrs.content) refs.push({ kind: t.attrs.property, url: t.attrs.content });
  }

  for (const { kind, url } of refs) {
    const href = decode(url).trim();
    if (!href) {
      error(rel, `empty ${kind} URL`);
      continue;
    }
    if (/^(mailto:|tel:|sms:|javascript:|data:)/i.test(href)) continue;
    if (/^(https?:)?\/\//i.test(href)) {
      if (site && href.startsWith(site.origin)) {
        // absolute self link: verify like an internal one
        const u = new URL(href);
        checkInternal(rel, kind, u.pathname + u.hash, route);
      }
      continue;
    }
    checkInternal(rel, kind, href, route);
  }
}

function checkInternal(rel, kind, href, route) {
  const u = new URL(href, `http://local${route}`);
  const pathname = decodeURIComponent(u.pathname);
  if (base && !(pathname === `${base}/` || pathname.startsWith(`${base}/`))) {
    error(rel, `${kind} "${href}" escapes the base path "${base}/"`);
    return;
  }
  const relPath = pathname.slice(base.length); // starts with '/'
  const hasExt = /\.[a-z0-9]+$/i.test(relPath);
  let targetFile;
  if (relPath.endsWith('/')) targetFile = path.join(dist, relPath, 'index.html');
  else if (hasExt) targetFile = path.join(dist, relPath);
  else {
    error(rel, `${kind} "${href}" is a page link without a trailing slash (trailingSlash is "always")`);
    return;
  }
  return existsSync(targetFile).then((ok) => {
    if (!ok) {
      error(rel, `${kind} "${href}" does not resolve to a file in dist/`);
      return;
    }
    if (u.hash && targetFile.endsWith('.html')) {
      const id = decodeURIComponent(u.hash.slice(1));
      if (!id) return;
      const targetRoute = `${base}${relPath}`;
      const target = pages.get(targetRoute);
      if (target && !target.ids.has(id)) error(rel, `${kind} "${href}" points at #${id} which does not exist on ${target.rel}`);
    }
  });
}

await Promise.all(pendingChecks);

// Sitemap and robots
const sitemapIndex = path.join(dist, 'sitemap-index.xml');
const sitemap0 = path.join(dist, 'sitemap-0.xml');
if (!(await exists(sitemapIndex))) error('dist', 'sitemap-index.xml missing');
if (!(await exists(sitemap0))) error('dist', 'sitemap-0.xml missing');
else {
  const xml = await readFile(sitemap0, 'utf8');
  const locs = new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname));
  for (const [route, page] of pages) {
    if (page.rel === '404.html') continue;
    if (!locs.has(route)) error('sitemap-0.xml', `does not list ${route}`);
  }
}
const robots = path.join(dist, 'robots.txt');
if (!(await exists(robots))) error('dist', 'robots.txt missing');
else if (!/^Sitemap: https?:\/\//m.test(await readFile(robots, 'utf8'))) error('robots.txt', 'has no absolute Sitemap: line');

console.log(`Checked ${pages.size} pages under base "${base || '/'}".`);
for (const w of warnings) console.log(`warning  ${w}`);
for (const e of errors) console.log(`error    ${e}`);
console.log(`${errors.length} error(s), ${warnings.length} warning(s).`);
process.exit(errors.length ? 1 : 0);
