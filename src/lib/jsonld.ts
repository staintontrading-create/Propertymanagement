/**
 * Serialise structured data for a <script type="application/ld+json"> block.
 * Content-driven strings (service names, FAQ answers) could one day contain
 * "</script>" or "<!--"; escaping "<" keeps the script element intact.
 */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
