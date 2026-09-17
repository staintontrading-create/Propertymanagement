#!/usr/bin/env node
/**
 * Post-build CSS coverage check.
 *
 * Astro scopes component styles with a data-astro-cid-* attribute. A rule
 * written in a parent component for an element that a child component renders
 * only applies if the child forwards that attribute onto its root. When it does
 * not, the rule compiles, ships and silently matches nothing. This script
 * renders every built page with linkedom, collects every rule from the external
 * stylesheets and inline <style> blocks, and reports any selector that matches
 * no element on any page.
 *
 * Any selector that matches nothing is an error. A scoped selector (one
 * carrying data-astro-cid-*) is almost always the forwarding bug above; an
 * unscoped one is dead global CSS. Both are fixed by deleting the rule or by
 * making it apply, never by widening the allow-lists below without a reason.
 *
 * State that only exists after user interaction or JavaScript (hover, focus,
 * open <details>, form errors, the scrolled header, the open menu) cannot be
 * seen in static HTML, so those pseudo-classes are stripped and those state
 * tokens are skipped; see STATE_TOKENS.
 *
 * Exits non-zero when any error is found.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, 'dist');

/** Pseudo-classes that describe a state a static page cannot be in. */
const STATE_PSEUDO = /:(?:hover|active|focus-visible|focus-within|focus|visited|target|checked|disabled|enabled|user-invalid|user-valid|invalid|valid|placeholder-shown|autofill|popover-open|modal)\b/g;
/** Pseudo-elements never match an element. */
const PSEUDO_ELEMENT = /::?(?:-webkit-details-marker|before|after|marker|placeholder|selection|backdrop|first-line|first-letter|file-selector-button|details-content)\b/g;
/**
 * Selector fragments that only exist after JavaScript or interaction has run.
 * A selector containing any of these is not checked.
 */
const STATE_TOKENS = [
  /\[open\]/, // <details> and <dialog> open state
  /\[data-state/, // form status strip
  /\[data-busy/, // form submitting
  /\[aria-invalid/, // failed validation
  /\[aria-expanded="?true"?\]/, // menu button while the dialog is open
  /\[aria-current/, // set per page; checked separately by verify-dist
  /\.is-scrolled/, // header after scroll
  /\.is-hidden/, // contact bar hidden while typing
  /\.menu-open/, // <html> while the dialog is open
  /\.field__error/, // inserted by the form script
  /\.form__status/, // filled by the form script
  /\.js\b/, // <html class="js"> set by the inline script
  /:has\(/, // linkedom's selector engine does not support :has()
  /\[hidden\]/, // toggled by script
];
/**
 * Selector fragments that only match once the owner adds content or changes
 * the configuration: rules for real photographs, long-form prose lists and
 * shorter company names. They are kept on purpose and not checked.
 */
const CONTENT_TOKENS = [
  /\.slot--filled/, // a photo slot with a real photograph
  /\.slot__frame\S* img/, // the photograph itself
  /^\.prose (?:h3|ul|ol|li)/, // long-form content elements the notice may gain
  /\.wordmark--long/, // a company name between 19 and 26 characters
];
/** Bare element selectors are base styles for elements content may introduce (img, video, blockquote, small). */
const isBaseElementSelector = (selector) => /^[a-z][a-z0-9]*(?:\s*,\s*[a-z][a-z0-9]*)*$/i.test(selector);

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

/** Split a stylesheet into top-level blocks, recursing into @media/@supports/@layer/@container. */
function extractRules(css, origin, out = []) {
  let i = 0;
  const n = css.length;
  while (i < n) {
    // skip whitespace and comments
    if (/\s/.test(css[i])) { i += 1; continue; }
    if (css.startsWith('/*', i)) { const e = css.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    const open = css.indexOf('{', i);
    if (open < 0) break;
    const prelude = css.slice(i, open).trim();
    // find the matching closing brace
    let depth = 1;
    let j = open + 1;
    while (j < n && depth > 0) {
      if (css[j] === '{') depth += 1;
      else if (css[j] === '}') depth -= 1;
      j += 1;
    }
    const body = css.slice(open + 1, j - 1);
    i = j;
    if (prelude.startsWith('@')) {
      const name = prelude.slice(1).split(/[\s(]/)[0];
      if (['media', 'supports', 'layer', 'container', 'scope'].includes(name)) extractRules(body, `${origin} ${prelude}`, out);
      // @font-face, @keyframes, @property, @import: nothing to match
      continue;
    }
    if (prelude) out.push({ selector: prelude, origin });
  }
  return out;
}

/** Split a selector list on top-level commas (commas inside :is()/:not() are kept). */
function splitSelectorList(list) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of list) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) { parts.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function normalise(selector) {
  return selector.replace(PSEUDO_ELEMENT, '').replace(STATE_PSEUDO, '').replace(/\s+/g, ' ').trim();
}

const files = await walk(dist);
const pages = files.filter((f) => f.endsWith('.html'));
const documents = [];
const cssSources = new Map(); // origin -> css text
for (const file of pages) {
  const html = await readFile(file, 'utf8');
  const { document } = parseHTML(html);
  const rel = '/' + path.relative(dist, file).split(path.sep).join('/');
  documents.push({ rel, document });
  for (const style of document.querySelectorAll('style')) {
    const key = `${rel} <style>`;
    cssSources.set(key, (cssSources.get(key) ?? '') + '\n' + style.textContent);
  }
  for (const link of document.querySelectorAll('link[rel="stylesheet"][href]')) {
    const href = link.getAttribute('href');
    const url = new URL(href, 'http://local/');
    // locate the file under dist regardless of the base path prefix
    const candidates = files.filter((f) => f.endsWith(url.pathname.split('/').pop()));
    if (!candidates.length) { console.error(`stylesheet not found in dist: ${href} (from ${rel})`); process.exit(1); }
    if (!cssSources.has(href)) cssSources.set(href, await readFile(candidates[0], 'utf8'));
  }
}

const errors = [];
const warnings = [];
let checked = 0;
let skipped = 0;
const seen = new Set();
for (const [origin, css] of cssSources) {
  for (const rule of extractRules(css, origin)) {
    for (const raw of splitSelectorList(rule.selector)) {
      const selector = normalise(raw);
      if (!selector) continue; // e.g. a rule that was only ::selection
      // inline styles repeat on every page; one verdict per selector is enough
      if (seen.has(selector)) continue;
      seen.add(selector);
      if (STATE_TOKENS.some((re) => re.test(selector)) || CONTENT_TOKENS.some((re) => re.test(selector)) || isBaseElementSelector(selector)) { skipped += 1; continue; }
      checked += 1;
      let matched = false;
      for (const { document } of documents) {
        try {
          if (document.querySelector(selector)) { matched = true; break; }
        } catch (err) {
          // a selector linkedom cannot parse: treat as skipped, but say so
          skipped += 1;
          matched = true;
          warnings.push(`unparsable selector, skipped: ${raw} (${rule.origin})`);
          break;
        }
      }
      if (!matched) errors.push(`${raw}  [${rule.origin.replace(/^\/.*?<style>/, 'inline <style>')}]`);
    }
  }
}

if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  - ${w}`);
}
if (errors.length) {
  console.log(`\n${errors.length} selector(s) match nothing on any page. A scoped selector (data-astro-cid-*) usually means a child component is not forwarding the parent's scope attribute; otherwise the rule is dead and should be deleted, or listed in STATE_TOKENS or CONTENT_TOKENS with a reason:`);
  for (const e of errors) console.log(`  - ${e}`);
}
console.log(`\nCSS coverage: ${checked} selector(s) checked across ${documents.length} page(s), ${skipped} state- or content-dependent selector(s) skipped, ${errors.length} error(s), ${warnings.length} warning(s).`);
process.exit(errors.length ? 1 : 0);
