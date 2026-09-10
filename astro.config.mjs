// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

/**
 * Deployment target.
 *
 * Defaults produce a build that works on the GitHub Pages *project* site for
 * this repository (https://<owner>.github.io/<repo>/). Override both values
 * for a custom domain, e.g.
 *
 *   SITE_URL=https://www.example.com BASE_PATH=/ npm run build
 *
 * The GitHub Actions workflow reads the same two values from repository
 * variables (Settings → Secrets and variables → Actions → Variables).
 * Empty strings are treated as unset so an undefined repository variable
 * falls back to the defaults.
 */
const SITE_URL = process.env.SITE_URL || 'https://staintontrading-create.github.io';
const BASE_PATH = process.env.BASE_PATH || '/Propertymanagement';

export default defineConfig({
  site: SITE_URL,
  base: BASE_PATH,
  // Every internal URL ends with a slash so links resolve identically on
  // GitHub Pages, `astro preview` and any static host.
  trailingSlash: 'always',
  // Collapse whitespace with HTML rules (Astro 6 behaviour) rather than the
  // Astro 7 JSX default, so inline text like <a>…</a> <strong>…</strong> keeps
  // its separating space without needing {" "} everywhere.
  compressHTML: true,
  integrations: [sitemap()],
});
