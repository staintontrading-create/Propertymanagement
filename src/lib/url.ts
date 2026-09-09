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
