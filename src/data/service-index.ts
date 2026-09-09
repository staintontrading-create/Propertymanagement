import type { ServiceSlug } from './types';

/**
 * How the seven services are grouped in the services overview, the home page
 * grid and the mobile menu. Order here is the display order everywhere; the
 * two-digit codes live on each Service entry in services.ts.
 */
export interface ServiceGroup {
  key: string;
  label: string;
  slugs: ServiceSlug[];
}

export const serviceGroups: ServiceGroup[] = [
  {
    key: 'home',
    label: 'For the home',
    slugs: ['property-management', 'handyman', 'renovations'],
  },
  {
    key: 'stays',
    label: 'For guests and stays',
    slugs: ['short-term-rentals', 'holiday-home-maintenance'],
  },
  {
    key: 'checks',
    label: 'For checks and handovers',
    slugs: ['property-handovers', 'property-inspections'],
  },
];

/** Group a service belongs to, by slug. */
export function groupOf(slug: ServiceSlug): ServiceGroup {
  const group = serviceGroups.find((g) => g.slugs.includes(slug));
  if (!group) throw new Error(`Service "${slug}" is not in any group in service-index.ts`);
  return group;
}

/** Every slug, in display order. */
export const serviceOrder: ServiceSlug[] = serviceGroups.flatMap((g) => g.slugs);
