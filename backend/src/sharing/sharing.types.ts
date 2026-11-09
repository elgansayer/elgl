export const SHARE_ENTITY_TYPES = [
  'tutor',
  'group',
  'room',
  'moment',
  'event',
] as const;

export type ShareEntityType = (typeof SHARE_ENTITY_TYPES)[number];

export interface SharePricing {
  /** Price expressed in UK pounds. */
  ukp: number;
  /** Equivalent price expressed in US dollars. */
  usd: number;
  /** Pre-formatted dual-currency label, for example "10 UKP / 12.50 USD". */
  display: string;
}

export interface SharePreview {
  entityType: ShareEntityType;
  entityId: string;
  title: string;
  description: string;
  imageUrl: string | null;
  siteName: string;
  /** Canonical sharing URL served by the NestJS OpenGraph endpoint. */
  shareUrl: string;
  /** Angular route that opens the entity inside the app. */
  webUrl: string;
  /** Custom scheme URL that opens the entity in the native app. */
  deepLink: string;
  pricing: SharePricing | null;
}

export interface ShareLink {
  entityType: ShareEntityType;
  entityId: string;
  shareUrl: string;
  webUrl: string;
  deepLink: string;
}

export interface ShareLinkPreview {
  entityType: ShareEntityType;
  entityId: string;
  webUrl: string;
  deepLink: string;
  pricing: SharePricing | null;
}

export function isShareEntityType(value: string): value is ShareEntityType {
  return (SHARE_ENTITY_TYPES as readonly string[]).includes(value);
}
