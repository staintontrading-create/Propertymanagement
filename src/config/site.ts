/**
 * Single source of truth for everything company-specific.
 *
 * Every value marked PLACEHOLDER must be replaced before the site goes live.
 * Nothing else in the codebase hard-codes the company name, contact details or
 * service area, so editing this file is the only step needed to rebrand.
 */

export interface SiteConfig {
  /** Trading name shown in the header wordmark, titles and structured data. PLACEHOLDER. */
  name: string;
  /** Legal entity name used in the footer and privacy notice. PLACEHOLDER. */
  legalName: string;
  /** Short strapline used in the default page title and Open Graph data. */
  tagline: string;
  /** Default meta description, used when a page does not set its own. */
  description: string;
  /** BCP 47 language tag for the <html lang> attribute. */
  locale: string;
  /**
   * Optional description of where the company operates, e.g. "the Algarve" or
   * "Dubai Marina and JBR". Rendered in the hero eyebrow, footer and contact
   * page only when set. PLACEHOLDER (empty string hides it).
   */
  areasCovered: string;
  contact: {
    /** Human-readable phone number. PLACEHOLDER. */
    phoneDisplay: string;
    /** E.164 number without spaces for tel: links, e.g. "+34600000000". PLACEHOLDER. */
    phoneE164: string;
    /** Digits only, with country code, for wa.me links, e.g. "34600000000". PLACEHOLDER. */
    whatsappNumber: string;
    /** PLACEHOLDER. */
    email: string;
    /** Opening hours shown on the contact page. PLACEHOLDER. */
    hours: string;
    /** Optional postal address lines. Leave empty to hide. */
    addressLines: string[];
  };
  /**
   * Where the contact form posts. Any service that accepts a standard HTML
   * form POST works (Formspree, Basin, Getform, Netlify Forms with the
   * appropriate attribute, a Cloudflare Worker...). Leave empty to fall back to
   * a mailto: link that opens the visitor's email client with the message
   * pre-filled. PLACEHOLDER.
   */
  formEndpoint: string;
  /** Optional external links. Each is rendered only when non-empty. */
  links: {
    instagram: string;
    facebook: string;
    linkedin: string;
    airbnb: string;
    booking: string;
  };
}

export const site: SiteConfig = {
  name: 'Stainton Property Management', // PLACEHOLDER: derived from the GitHub account name
  legalName: 'Stainton Property Management', // PLACEHOLDER
  tagline: 'Property care for owners who are not there',
  description:
    'Property management for owners who are not always on site: maintenance, renovations, short-term rentals, handovers, inspections and holiday-home care.',
  locale: 'en-GB',
  areasCovered: '', // PLACEHOLDER: e.g. "the Costa del Sol"
  contact: {
    phoneDisplay: '+00 000 000 000', // PLACEHOLDER
    phoneE164: '+00000000000', // PLACEHOLDER
    whatsappNumber: '00000000000', // PLACEHOLDER
    email: 'hello@example.com', // PLACEHOLDER
    hours: 'Monday to Saturday, 08:00 to 18:00', // PLACEHOLDER
    addressLines: [],
  },
  formEndpoint: '', // PLACEHOLDER: e.g. "https://formspree.io/f/xxxxxxxx"
  links: {
    instagram: '',
    facebook: '',
    linkedin: '',
    airbnb: '',
    booking: '',
  },
};

/** True when the configured WhatsApp number looks like an international number (7 to 15 digits). */
export function hasWhatsApp(): boolean {
  return /^\d{7,15}$/.test(site.contact.whatsappNumber);
}

/** wa.me link with an optional pre-filled message. */
export function whatsappUrl(message?: string): string {
  const base = `https://wa.me/${site.contact.whatsappNumber}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function telUrl(): string {
  return `tel:${site.contact.phoneE164}`;
}

export function mailtoUrl(subject?: string, body?: string): string {
  const params = new URLSearchParams();
  if (subject) params.set('subject', subject);
  if (body) params.set('body', body);
  const query = params.toString();
  return `mailto:${site.contact.email}${query ? `?${query}` : ''}`;
}
