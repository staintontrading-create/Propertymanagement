/**
 * Content model for the seven services.
 *
 * Every service detail page is rendered from one `Service` object by
 * src/pages/services/[slug].astro, so the shape below is the contract between
 * the content (src/data/services.ts) and the template. All copy fields are
 * plain text; no HTML is injected.
 */

export type IconName =
  | 'property-management'
  | 'handyman'
  | 'renovations'
  | 'short-term-rentals'
  | 'property-handovers'
  | 'property-inspections'
  | 'holiday-home-maintenance';

export type ServiceSlug = IconName;

export interface OwnerSituation {
  /** Short label, e.g. "You live abroad" */
  title: string;
  /** One or two sentences in the second person describing the situation. */
  text: string;
}

export interface IncludedItem {
  /** The task, phrased as a concrete action, e.g. "Meter readings recorded" */
  title: string;
  /** What that means in practice: who, when, how the owner hears about it. */
  detail: string;
}

export interface ExcludedItem {
  /** What is not part of this service, and how it is handled instead. */
  text: string;
  /** Sibling service that covers it, rendered as a link when set. */
  seeService?: ServiceSlug;
}

export interface ProcessStep {
  title: string;
  text: string;
  /** The visible output of the step, shown as "You receive: ...". */
  youReceive: string;
}

export interface Deliverable {
  title: string;
  detail: string;
}

export interface Faq {
  question: string;
  answer: string;
}

export interface Service {
  slug: ServiceSlug;
  /** Two-digit index used in navigation and eyebrows, "01" to "07". */
  code: string;
  /** Page title and card heading, e.g. "Property handovers" */
  name: string;
  /** Short label for navigation and the footer when the name is long. */
  navLabel: string;
  /**
   * One short sentence in the hero and on cards, e.g.
   * "Small jobs, fixed properly, priced before we start."
   */
  headline: string;
  /** One or two sentences under the headline stating what the owner gets. */
  promise: string;
  /** Card line after "Typical for:", e.g. "a flat you let out while living abroad". */
  typicalFor: string;
  /** Unique meta description, under 160 characters. */
  metaDescription: string;
  icon: IconName;
  /** Three owner situations this service is designed for. */
  audience: OwnerSituation[];
  /** Concrete tasks that are part of the service. */
  included: IncludedItem[];
  /** What is handled separately, with links to the sibling service. */
  notIncluded: ExcludedItem[];
  /** Four to six service-specific steps, each with a visible output. */
  steps: ProcessStep[];
  /** What the owner receives: report formats, cadence, records. */
  deliverables: Deliverable[];
  /** How the owner is kept informed: cadence, format and channel. */
  reporting: {
    cadence: string;
    format: string;
    channel: string;
  };
  /**
   * How the service is priced and what the written scope contains, one entry
   * per paragraph so the author, not a sentence splitter, decides the breaks.
   * No figures.
   */
  pricing: string[];
  /** Four to six questions owners actually ask, with specific answers. */
  faqs: Faq[];
  /** Two or three related services, by slug. */
  related: ServiceSlug[];
  /**
   * Exactly three photo slots reserved on the page, with the intended shot
   * described. Slot 0 sits beside the reporting section, slots 1 and 2 form
   * the "On site" band.
   */
  photoSlots: PhotoSlotSpec[];
}

/**
 * A reserved photograph on a service page. With only `label` and `ratio`
 * the page shows a finished, hatched frame naming the intended shot. Add
 * `src` (a path under public/, e.g. "/images/handover-pack.jpg"), `alt`,
 * `width` and `height` once the photograph exists.
 */
export interface PhotoSlotSpec {
  label: string;
  ratio: '16/9' | '4/3' | '3/2';
  src?: string;
  alt?: string;
  width?: number;
  height?: number;
}
