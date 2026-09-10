#!/usr/bin/env node
/**
 * Regenerate public/og-image.png, the 1200×630 preview shown when a page is
 * shared on WhatsApp, iMessage, LinkedIn or Facebook.
 *
 * The image is the site's own wordmark, tagline and example visit report, so
 * it must be regenerated whenever `name` or `tagline` in src/config/site.ts
 * changes. It is rendered by the site itself: a temporary page is added,
 * the site is built, the page is screenshotted with a headless browser,
 * then the page is removed and the site rebuilt clean.
 *
 * Needs Playwright with Chromium (not a project dependency, to keep deploys
 * light): `npm i -D playwright && npx playwright install chromium`, or a
 * global install. usage: npm run og-image
 */
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoute = 'og-image-source';
const tempPage = path.join(root, 'src', 'pages', `${tempRoute}.astro`);
const output = path.join(root, 'public', 'og-image.png');
const WIDTH = 1200;
const HEIGHT = 630;

const pageSource = `---
// TEMPORARY: written by scripts/og-image.mjs and removed again after the screenshot.
import '../styles/global.css';
import ReportCard from '../components/ReportCard.astro';
import PlanGrid from '../components/PlanGrid.astro';
import { site } from '../config/site';
---
<html lang="en-GB">
  <head>
    <meta charset="utf-8" />
    <meta name="robots" content="noindex" />
    <title>Open Graph image source</title>
    <style>
      html, body { margin: 0; background: var(--color-surface); }
      .og { position: relative; width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; display: grid; grid-template-columns: 1fr 26rem; gap: 4rem; align-items: center; padding: 0 5rem; box-sizing: border-box; }
      .og__copy { position: relative; z-index: 1; display: grid; gap: 1.25rem; }
      .og__name { font-family: var(--font-display); font-weight: 600; font-variation-settings: 'opsz' 72; font-size: 3.6rem; line-height: 1.05; letter-spacing: -0.01em; color: var(--color-primary-strong); margin: 0; }
      .og__tag { font-family: var(--font-body); font-size: 1.5rem; line-height: 1.4; color: var(--color-text-muted); margin: 0; max-width: 22ch; }
      .og__rule { display: block; width: 4rem; height: 3px; background: var(--color-accent); }
      .og__card { position: relative; z-index: 1; transform: rotate(-2deg) scale(0.86); transform-origin: center; }
      .og__card :global(.report) { max-width: 26rem; }
    </style>
  </head>
  <body>
    <div class="og">
      <PlanGrid position="right" />
      <div class="og__copy">
        <p class="og__name">{site.name}</p>
        <span class="og__rule" aria-hidden="true"></span>
        <p class="og__tag">{site.tagline}</p>
      </div>
      <div class="og__card"><ReportCard /></div>
    </div>
  </body>
</html>
`;

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    /* not installed in the project; try a global install */
  }
  try {
    const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
    return await import(pathToFileURL(path.join(globalRoot, 'playwright', 'index.mjs')).href);
  } catch {
    throw new Error(
      'Playwright is not installed. Run `npm i -D playwright && npx playwright install chromium` (or install it globally) and try again.',
    );
  }
}

function build() {
  execFileSync('npx', ['astro', 'build'], { cwd: root, stdio: 'inherit' });
}

async function serve(dist, base) {
  const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
  const server = http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (base && p.startsWith(base)) p = p.slice(base.length);
    if (p.endsWith('/')) p += 'index.html';
    try {
      const file = path.join(dist, p);
      await stat(file);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

const { chromium } = await loadPlaywright();
const { default: astroConfig } = await import(pathToFileURL(path.join(root, 'astro.config.mjs')).href);
const base = (astroConfig.base ?? '/').replace(/\/+$/, '');
const dist = path.join(root, 'dist');

let served;
let browser;
try {
  await writeFile(tempPage, pageSource);
  build();
  served = await serve(dist, base);
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  const failed = [];
  page.on('requestfailed', (r) => failed.push(r.url()));
  page.on('response', (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));
  await page.goto(`${served.origin}${base}/${tempRoute}/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const fonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family));
  if (!fonts.includes('Fraunces') || !fonts.includes('Inter')) throw new Error(`Web fonts did not load (loaded: ${fonts.join(', ') || 'none'})`);
  if (failed.length) throw new Error(`Requests failed while rendering:\n${failed.join('\n')}`);
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'og-'));
  const shot = path.join(tmp, 'og-image.png');
  await page.screenshot({ path: shot, clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT }, animations: 'disabled' });
  await writeFile(output, await readFile(shot));
  await rm(tmp, { recursive: true, force: true });
  console.log(`Wrote ${path.relative(root, output)} (${WIDTH}×${HEIGHT}) for "${await page.evaluate(() => document.querySelector('.og__name').textContent)}".`);
} finally {
  await browser?.close();
  served?.server.close();
  await rm(tempPage, { force: true });
  await rm(path.join(dist, tempRoute), { recursive: true, force: true });
}

// Leave dist/ as a normal build again (the sitemap must not list the temporary page).
build();
