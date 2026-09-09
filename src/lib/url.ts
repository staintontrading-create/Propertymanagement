/**
 * Base-path-aware URL helper.
 *
 * Astro's `base` option (see astro.config.mjs) is prepended to every internal
 * link so the site works both at the root of a custom domain and under a
 * GitHub Pages project path. `import.meta.env.BASE_URL` always ends with a
 * slash because `trailingSlash` is set to 'always'.
 *
 *   url('/')                      -> '/Propertymanagement/'
 *   url('/services/handyman/')    -> '/Propertymanagement/services/handyman/'
 *   url('services/handyman/')     -> '/Propertymanagement/services/handyman/'
 *   url('/contact/#form')         -> '/Propertymanagement/contact/#form'
 */
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '');

export function url(path: string): string {
  const clean = path.replace(/^\/+/, '');
  return `${BASE}/${clean}`;
}

/** Absolute URL (for canonical links, Open Graph and structured data). */
export function absoluteUrl(path: string, site: URL | undefined): string {
  if (!site) return url(path);
  return new URL(url(path), site).toString();
}

/**
 * The current page's path without the base prefix, always with a trailing
 * slash, so components can compare against site-relative paths like '/about/'.
 */
export function currentPath(pageUrl: URL): string {
  let p = pageUrl.pathname;
  if (BASE && p.startsWith(BASE)) p = p.slice(BASE.length);
  if (!p.startsWith('/')) p = `/${p}`;
  if (!p.endsWith('/')) p = `${p}/`;
  return p;
}

/** True when `path` (site-relative, e.g. '/services/') is the current page or an ancestor section. */
export function isActive(pageUrl: URL, path: string, exact = false): boolean {
  const current = currentPath(pageUrl);
  const target = path.endsWith('/') ? path : `${path}/`;
  if (exact || target === '/') return current === target;
  return current === target || current.startsWith(target);
}
