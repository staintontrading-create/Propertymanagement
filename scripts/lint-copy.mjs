#!/usr/bin/env node
/**
 * Copy lint: scans the authored text in src/ for wording the content rules
 * forbid, so that a rewrite cannot quietly reintroduce it.
 *
 *   - marketing filler and superlatives (premium, trusted, hassle-free, ...)
 *   - invented figures ("200 clients", "10 years", "98%") and star ratings
 *   - "24/7", which is only true if the business really answers around the clock
 *   - jurisdiction-specific terms (council tax, HOA, notary, strata, escrow);
 *     the site uses neutral words because the market is configurable
 *   - leftover template braces {{ }}
 *   - exclamation marks in prose
 *   - American spellings in prose
 *   - "peace of mind" more than once across the whole site
 *
 * What counts as copy: text nodes in .astro templates, and string literals in
 * frontmatter, .ts files and JSX expressions. Tags, attribute names, styles,
 * scripts and comments are ignored. Rules marked `proseOnly` additionally skip
 * single-word string literals, which are almost always code (enum values,
 * class names) rather than copy. Exits non-zero on any finding.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ROOTS = ['src/data', 'src/pages', 'src/components', 'src/layouts', 'src/config'].map((d) => path.join(root, d));

const RULES = [
  { re: /\b(premium|trusted|hassle-free|bespoke|stress-free|seamless|passionate|dedicated team|experts?|tailored|world-class|top-rated|award-winning)\b/gi, why: 'banned marketing phrase' },
  { re: /\bbest\b/gi, why: 'superlative' },
  { re: /\b24\s*\/\s*7\b/g, why: '"24/7" is a promise the copy cannot make' },
  { re: /\b\d[\d,.]*\s*\+?\s*(clients|customers|owners|years|properties|homes|reviews|%)\b/gi, why: 'invented figure' },
  { re: /\b[1-5](\.\d)?\s*stars?\b|★/gi, why: 'star rating' },
  { re: /\b(council tax|HOA|notary|strata|escrow|stamp duty)\b/g, why: 'jurisdiction-specific term' },
  { re: /\{\{|\}\}/g, why: 'template braces' },
  { re: /[A-Za-z]!(?![=.])/g, why: 'exclamation mark', proseOnly: true },
  { re: /\b(color|center|organize[sd]?|organization|license|program|neighbor|favor|realize[sd]?|analyze[sd]?|catalog)\b/g, why: 'American spelling in copy', proseOnly: true },
];
const ONCE = { re: /peace of mind/gi, why: '"peace of mind" may appear at most once on the site' };

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else if (/\.(astro|ts|mjs)$/.test(e.name)) out.push(full);
  }
  return out;
}

const blank = (s) => s.replace(/[^\n]/g, ' ');
const STRING_RE = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g;

/**
 * Two position-preserving views of a file: `strings` keeps only string
 * literal contents, `text` keeps only template text nodes. Everything else is
 * replaced by spaces so line numbers survive.
 */
function views(file, raw) {
  let code = raw;
  let template = '';
  if (file.endsWith('.astro')) {
    const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
    const fmEnd = m ? m[0].length : 0;
    code = raw.slice(0, fmEnd) + blank(raw.slice(fmEnd));
    template = blank(raw.slice(0, fmEnd)) + raw.slice(fmEnd);
    template = template
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, blank)
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, blank)
      .replace(/<!--[\s\S]*?-->/g, blank);
  }
  // string literals: frontmatter/TS code plus attribute values and JSX expressions in the template
  const stringSource = file.endsWith('.astro') ? code.replace(/\/\*[\s\S]*?\*\//g, blank) + '' : raw.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/^\s*\/\/.*$/gm, blank);
  const literalSource = file.endsWith('.astro') ? raw.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, blank).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, blank).replace(/\/\*[\s\S]*?\*\//g, blank) : stringSource;
  let strings = blank(literalSource);
  const strArr = strings.split('');
  for (const m of literalSource.matchAll(STRING_RE)) {
    const inner = m[0].slice(1, -1);
    for (let i = 0; i < inner.length; i++) strArr[m.index + 1 + i] = inner[i];
  }
  strings = strArr.join('');

  let text = '';
  if (template) {
    // drop tags and JSX expressions, keep text nodes
    text = template.replace(/<[^>]*>/g, blank).replace(/\{[^{}]*(\{[^{}]*\}[^{}]*)*\}/g, blank);
  }
  return { strings, text: text || blank(raw) };
}

/** Position-preserving view keeping only string literals that contain whitespace. */
function proseView(file, raw) {
  const source = file.endsWith('.astro')
    ? raw.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, blank).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, blank).replace(/\/\*[\s\S]*?\*\//g, blank)
    : raw.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/^\s*\/\/.*$/gm, blank);
  const arr = blank(source).split('');
  for (const m of source.matchAll(STRING_RE)) {
    const inner = m[0].slice(1, -1);
    if (!/\s/.test(inner)) continue;
    for (let i = 0; i < inner.length; i++) arr[m.index + 1 + i] = inner[i];
  }
  return arr.join('');
}

const findings = [];
let peaceCount = 0;
const files = (await Promise.all(ROOTS.map(walk))).flat();
for (const file of files) {
  const raw = await readFile(file, 'utf8');
  const rel = path.relative(root, file);
  const { strings, text } = views(file, raw);
  const lineOf = (index) => raw.slice(0, index).split('\n').length;
  // prose-only view: string literals that contain whitespace (single tokens are code)
  const prose = proseView(file, raw);

  for (const rule of RULES) {
    const sources = rule.proseOnly ? [prose, text] : [strings, text];
    const reported = new Set();
    for (const src of sources) {
      for (const m of src.matchAll(rule.re)) {
        const key = `${m.index}`;
        if (reported.has(key)) continue;
        reported.add(key);
        findings.push(`${rel}:${lineOf(m.index)}: "${m[0]}" (${rule.why})`);
      }
    }
  }
  for (const src of [strings, text]) {
    for (const m of src.matchAll(ONCE.re)) {
      peaceCount += 1;
      if (peaceCount > 1) findings.push(`${rel}:${lineOf(m.index)}: "${m[0]}" (${ONCE.why})`);
    }
  }
}

if (findings.length) {
  for (const f of findings) console.log(`error    ${f}`);
  console.log(`${findings.length} copy finding(s) in ${files.length} files.`);
  process.exit(1);
}
console.log(`Copy lint: no findings in ${files.length} files.`);
