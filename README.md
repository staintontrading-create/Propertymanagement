# Property management website

Marketing site for a property management company that looks after homes for owners who are not on site: complete property management, handyman services, renovations, short-term rental management (Airbnb and Booking.com), property handovers, property inspections and holiday-home maintenance.

Built with [Astro](https://astro.build) as a fully static site: no database, no server, no cookies, no third-party scripts, self-hosted fonts. It deploys to GitHub Pages out of the box and to any static host with two environment variables.

## Before going live

Everything company-specific lives in one file: `src/config/site.ts`. Every value marked `PLACEHOLDER` there must be replaced:

| Field | What it is |
| --- | --- |
| `name`, `legalName` | Trading name (header, titles) and legal entity (footer, privacy notice). |
| `areasCovered` | Optional, e.g. "the Algarve". Shown in the hero eyebrow, footer and contact page when set; hidden when empty. |
| `contact.phoneDisplay`, `contact.phoneE164` | The number as people read it, and in international format for `tel:` links. |
| `contact.whatsappNumber` | Digits only with country code. Leave empty to hide every WhatsApp button. |
| `contact.email`, `contact.hours`, `contact.addressLines` | Email, opening hours, optional postal address. |
| `formEndpoint` | Where the contact and quote forms post (see below). |
| `links` | Optional social and listing URLs; each renders only when set. |

Also complete the privacy notice (`src/pages/privacy.astro`): the lines marked "To confirm before launch" need the legal name, the form service, the hosting provider and the retention periods.

Then regenerate the social preview image (`public/og-image.png`, shown when a page is shared on WhatsApp, LinkedIn or Facebook). It is rendered from the site's own wordmark, tagline and example visit report, so it goes stale when `name` or `tagline` changes:

```sh
npm i -D playwright && npx playwright install chromium   # once
npm run og-image
```

## Forms

Both forms (contact page and "Request a written scope") are plain HTML forms enhanced with a small script (`src/scripts/enquiry-form.ts`):

- With `formEndpoint` set to a service that accepts a standard form POST (Formspree, Basin, Getform, a Cloudflare Worker, and so on), submissions are sent there and a confirmation is shown on the page.
- With `formEndpoint` empty, submitting opens the visitor's email app with the message pre-filled, addressed to `contact.email`.

There is a honeypot field for bots and no CAPTCHA. Field values are never stored by the site itself.

## Running locally

Requires Node.js 22.12 or newer.

```bash
npm install
npm run dev        # http://localhost:4321/Propertymanagement/
npm run build      # static output in dist/
npm run preview    # serve dist/ locally
npm test           # type check, build and verify the output
```

`npm run verify` (part of `npm test`) checks every generated page for broken internal links and anchors, one `<h1>`, unique titles and descriptions, alt text, heading order, leftover placeholders, and that the sitemap and robots.txt cover every page. `npm run lint:copy` (also part of `npm test`) fails the build if the copy picks up marketing filler, invented figures, jurisdiction-specific terms or American spellings.

## Deploying

### GitHub Pages (default)

The workflow in `.github/workflows/deploy.yml` builds and publishes the site to the repository's GitHub Pages project site whenever `main` is pushed. Enable it once under **Settings → Pages → Build and deployment → Source: GitHub Actions**. The default configuration targets `https://<owner>.github.io/<repository>/`.

### Custom domain or another host

Set two repository variables (**Settings → Secrets and variables → Actions → Variables**) or environment variables when building:

| Variable | Value |
| --- | --- |
| `SITE_URL` | The full origin, e.g. `https://www.example.com` |
| `BASE_PATH` | `/` |

Both default to the GitHub Pages values in `astro.config.mjs`. Every internal link is generated from them, so the same code works at the root of a domain or under a sub-path.

## Editing content

| What | Where |
| --- | --- |
| The seven service pages | `src/data/services.ts`, one typed object per service (`src/data/types.ts` documents every field). |
| Service grouping and order | `src/data/service-index.ts` |
| The five "how we work" steps | `src/data/process.ts` |
| Home, about, contact, privacy, 404 | `src/pages/` |
| Colours, type scale, spacing | `src/styles/global.css` (design tokens at the top) |

The site never shows prices, client numbers, ratings or testimonials by design: every claim is something the business controls (response time, report format, key logging, approval threshold).

## Adding photographs

Every reserved image area is a `PhotoSlot` showing a hatched frame with a label naming the intended shot ("Photo: meter readings on handover day"). To fill one, put the image in `public/images/` and give the slot `src`, `alt`, `width` and `height`; the frame stays and the hatch disappears.

- Service pages: add those four fields to the slot's entry under `photoSlots` in `src/data/services.ts`, with `src` as a path under `public/` such as `/images/handover-pack.jpg`.
- Other pages: pass the same props to the `PhotoSlot` component in `src/pages/`, wrapping the path with the `url()` helper from `src/lib/url.ts` so it works under the GitHub Pages sub-path.

## Project structure

```
src/
  config/site.ts        company details (the only file to edit to rebrand)
  data/                 typed content: services, groups, process steps
  layouts/BaseLayout    head, header, footer, contact strip, mobile bar
  components/           Astro components with scoped vanilla CSS
  pages/                routes (services/[slug].astro renders the seven service pages)
  styles/global.css     design tokens and base styles
  scripts/              the one client-side script (form enhancement)
public/fonts/           self-hosted Fraunces and Inter
scripts/verify-dist.mjs post-build checks
scripts/lint-copy.mjs   content rules lint
scripts/og-image.mjs    regenerates public/og-image.png from the built site
```
