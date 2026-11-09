import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { formatDualCurrencyPrice } from './dual-currency';
import type { LinkPreview } from '../link-preview/interfaces/link-preview.interface';
import {
  isShareEntityType,
  type ShareEntityType,
  type ShareLink,
  type ShareLinkPreview,
  type SharePreview,
  type SharePricing,
} from './sharing.types';

interface TutorRow {
  id: string;
  display_name?: string | null;
  business_name?: string | null;
  bio_text?: string | null;
  avatar_url?: string | null;
  native_languages?: string[] | null;
  target_languages?: string[] | null;
  profile_visibility?: string | null;
  is_deleted?: boolean | null;
  scheduled_for_deletion_at?: string | null;
  catalog?: unknown;
}

interface GroupRow {
  id: string;
  name: string;
  description?: string | null;
  interest_id?: string | null;
  owner_id?: string | null;
}

interface RoomRow {
  id: string;
  title?: string | null;
  room_name?: string | null;
  language_pair?: string | null;
  topic_tag?: string | null;
  level?: string | null;
  is_private?: boolean | null;
}

interface MomentRow {
  id: string;
  text_content?: string | null;
  media_urls?: string[] | null;
  post_type?: string | null;
  is_ephemeral?: boolean | null;
  expires_at?: string | null;
}

interface EventRow {
  id: string;
  title: string;
  description?: string | null;
  date_time?: string | null;
  location?: string | null;
  language_pair?: string | null;
}

type ShareTarget = {
  entityType: ShareEntityType;
  entityId: string;
};

const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 300;
const MAX_URL_LENGTH = 2_048;

@Injectable()
export class SharingService {
  private readonly logger = new Logger(SharingService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  async getPreview(
    entityType: ShareEntityType,
    entityId: string,
  ): Promise<SharePreview> {
    const entity = await this.resolveEntity(entityType, entityId);
    const webUrl = this.webPath(entityType, entityId);
    const appUrl = this.appBaseUrl();

    return {
      entityType,
      entityId,
      title: entity.title,
      description: entity.description,
      imageUrl: entity.imageUrl,
      siteName: entity.siteName,
      shareUrl: `${appUrl}/api/sharing/og/${entityType}/${encodeURIComponent(entityId)}`,
      webUrl,
      deepLink: this.deepLink(entityType, entityId),
      pricing: entity.pricing,
    };
  }

  async getShareLink(
    entityType: ShareEntityType,
    entityId: string,
  ): Promise<ShareLink> {
    const preview = await this.getPreview(entityType, entityId);
    return {
      entityType,
      entityId,
      shareUrl: preview.shareUrl,
      webUrl: preview.webUrl,
      deepLink: preview.deepLink,
    };
  }

  /**
   * Resolves share URLs that point at this service without making an outbound
   * request. Chat delivery uses this so a shared entity stays a rich card even
   * when the API host is not publicly reachable from the backend container.
   */
  async getLinkPreviewForShareUrl(rawUrl: string): Promise<LinkPreview | null> {
    const target = this.parseShareUrl(rawUrl);
    if (!target) {
      return null;
    }

    try {
      const preview = await this.getPreview(target.entityType, target.entityId);
      const share: ShareLinkPreview = {
        entityType: preview.entityType,
        entityId: preview.entityId,
        webUrl: preview.webUrl,
        deepLink: preview.deepLink,
        pricing: preview.pricing,
      };
      return {
        url: preview.shareUrl,
        title: preview.title,
        description: preview.pricing
          ? `${preview.description} - ${preview.pricing.display}`
          : preview.description,
        image: preview.imageUrl ?? '',
        siteName: preview.siteName,
        share,
      };
    } catch (error: unknown) {
      if (!(error instanceof NotFoundException)) {
        this.logger.warn(
          `Share preview resolution failed (${target.entityType}; ${error instanceof Error ? error.name : 'UnknownError'})`,
        );
      }
      return null;
    }
  }

  parseShareUrl(rawUrl: string): ShareTarget | null {
    if (!rawUrl || rawUrl.length > MAX_URL_LENGTH) {
      return null;
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return null;
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    if (parsed.host !== this.ownHost()) {
      return null;
    }

    const match = /^\/api\/sharing\/og\/([a-z]+)\/([A-Za-z0-9_-]+)\/?$/.exec(
      parsed.pathname,
    );
    if (!match) {
      return null;
    }

    const entityType = match[1];
    const entityId = match[2];
    if (!isShareEntityType(entityType)) {
      return null;
    }

    return { entityType, entityId };
  }

  renderOpenGraphHtml(preview: SharePreview): string {
    const title = this.escapeHtml(preview.title);
    const description = this.escapeHtml(this.ogDescription(preview));
    const siteName = this.escapeHtml(preview.siteName);
    const shareUrl = this.escapeHtml(preview.shareUrl);
    const webUrl = this.escapeHtml(`${this.appBaseUrl()}${preview.webUrl}`);
    const image = preview.imageUrl ? this.escapeHtml(preview.imageUrl) : null;

    const imageTags = image
      ? `<meta property="og:image" content="${image}">
    <meta property="og:image:alt" content="${title}">
    <meta name="twitter:image" content="${image}">`
      : '';
    const twitterCard = image ? 'summary_large_image' : 'summary';
    const priceTags = preview.pricing
      ? `<meta property="product:price:amount" content="${preview.pricing.ukp}">
    <meta property="product:price:currency" content="GBP">
    <meta property="product:price:amount" content="${preview.pricing.usd}">
    <meta property="product:price:currency" content="USD">`
      : '';

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title} | ${siteName}</title>
    <meta name="description" content="${description}">
    <link rel="canonical" href="${shareUrl}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${siteName}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:url" content="${shareUrl}">
    <meta name="twitter:card" content="${twitterCard}">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    ${imageTags}
    ${priceTags}
    <meta http-equiv="refresh" content="0; url=${webUrl}">
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p>${description}</p>
      <a href="${webUrl}">${webUrl}</a>
    </main>
  </body>
</html>`;
  }

  private async resolveEntity(
    entityType: ShareEntityType,
    entityId: string,
  ): Promise<{
    title: string;
    description: string;
    imageUrl: string | null;
    siteName: string;
    pricing: SharePricing | null;
  }> {
    switch (entityType) {
      case 'tutor':
        return this.resolveTutor(entityId);
      case 'group':
        return this.resolveGroup(entityId);
      case 'room':
        return this.resolveRoom(entityId);
      case 'moment':
        return this.resolveMoment(entityId);
      case 'event':
        return this.resolveEvent(entityId);
      default:
        throw new BadRequestException('Unsupported share entity type');
    }
  }

  private async resolveTutor(entityId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('users')
      .select(
        'id, display_name, business_name, bio_text, avatar_url, native_languages, target_languages, profile_visibility, is_deleted, scheduled_for_deletion_at, catalog',
      )
      .eq('id', entityId)
      .maybeSingle();

    const row = data as TutorRow | null;
    if (
      error ||
      !row ||
      row.is_deleted ||
      row.scheduled_for_deletion_at ||
      row.profile_visibility === 'hidden' ||
      row.profile_visibility === 'vips_only'
    ) {
      throw new NotFoundException('Share target not found');
    }

    const name =
      this.cleanText(row.business_name) ?? this.cleanText(row.display_name);
    const languages = (row.target_languages ?? [])
      .filter((language): language is string => typeof language === 'string')
      .join(', ');

    return {
      title: this.truncate(name ?? 'HelloTalk learner', MAX_TITLE_LENGTH),
      description: this.truncate(
        this.cleanText(row.bio_text) ??
          (languages
            ? `Practising ${languages} on HelloTalk`
            : 'Language exchange partner on HelloTalk'),
        MAX_DESCRIPTION_LENGTH,
      ),
      imageUrl: this.normaliseImageUrl(row.avatar_url),
      siteName: 'HelloTalk',
      pricing: this.findCataloguePrice(row.catalog),
    };
  }

  private async resolveGroup(entityId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('groups')
      .select('id, name, description, interest_id, owner_id')
      .eq('id', entityId)
      .maybeSingle();

    const row = data as GroupRow | null;
    if (error || !row) {
      throw new NotFoundException('Share target not found');
    }

    return {
      title: this.truncate(
        this.cleanText(row.name) ?? 'HelloTalk group',
        MAX_TITLE_LENGTH,
      ),
      description: this.truncate(
        this.cleanText(row.description) ?? 'Language group on HelloTalk',
        MAX_DESCRIPTION_LENGTH,
      ),
      imageUrl: null,
      siteName: 'HelloTalk',
      pricing: null,
    };
  }

  private async resolveRoom(entityId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('audio_rooms')
      .select(
        'id, title, room_name, language_pair, topic_tag, level, is_private',
      )
      .eq('id', entityId)
      .maybeSingle();

    const row = data as RoomRow | null;
    if (error || !row || row.is_private) {
      throw new NotFoundException('Share target not found');
    }

    const title = this.cleanText(row.title) ?? this.cleanText(row.room_name);
    const details = [
      this.cleanText(row.language_pair),
      this.cleanText(row.topic_tag),
    ]
      .filter((value): value is string => Boolean(value))
      .join(' - ');

    return {
      title: this.truncate(title ?? 'HelloTalk live room', MAX_TITLE_LENGTH),
      description: this.truncate(
        details || 'Live audio room on HelloTalk',
        MAX_DESCRIPTION_LENGTH,
      ),
      imageUrl: null,
      siteName: 'HelloTalk Live',
      pricing: null,
    };
  }

  private async resolveMoment(entityId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('moments')
      .select(
        'id, text_content, media_urls, post_type, is_ephemeral, expires_at',
      )
      .eq('id', entityId)
      .maybeSingle();

    const row = data as MomentRow | null;
    if (error || !row) {
      throw new NotFoundException('Share target not found');
    }
    if (this.isExpiredMoment(row)) {
      throw new NotFoundException('Share target not found');
    }

    const text = this.cleanText(row.text_content);
    const firstMedia = Array.isArray(row.media_urls)
      ? row.media_urls.find(
          (url): url is string =>
            typeof url === 'string' && url.trim().length > 0,
        )
      : undefined;

    return {
      title: this.truncate(text ?? 'HelloTalk moment', MAX_TITLE_LENGTH),
      description: this.truncate(
        text ?? 'Moment shared on HelloTalk',
        MAX_DESCRIPTION_LENGTH,
      ),
      imageUrl: this.normaliseImageUrl(firstMedia),
      siteName: 'HelloTalk',
      pricing: null,
    };
  }

  private async resolveEvent(entityId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('events')
      .select('id, title, description, date_time, location, language_pair')
      .eq('id', entityId)
      .maybeSingle();

    const row = data as EventRow | null;
    if (error || !row) {
      throw new NotFoundException('Share target not found');
    }

    const description =
      this.cleanText(row.description) ??
      this.cleanText(row.location) ??
      'Language event on HelloTalk';

    return {
      title: this.truncate(
        this.cleanText(row.title) ?? 'HelloTalk event',
        MAX_TITLE_LENGTH,
      ),
      description: this.truncate(description, MAX_DESCRIPTION_LENGTH),
      imageUrl: null,
      siteName: 'HelloTalk',
      pricing: null,
    };
  }

  private isExpiredMoment(row: MomentRow): boolean {
    if (!row.is_ephemeral || !row.expires_at) {
      return false;
    }
    const expiry = Date.parse(row.expires_at);
    return Number.isFinite(expiry) && expiry <= Date.now();
  }

  private findCataloguePrice(catalog: unknown): SharePricing | null {
    if (!Array.isArray(catalog)) {
      return null;
    }

    for (const entry of catalog) {
      if (typeof entry !== 'object' || entry === null) {
        continue;
      }
      const record = entry as Record<string, unknown>;
      const amount = this.parseAmount(record['price']);
      const currency =
        typeof record['currency'] === 'string' ? record['currency'] : null;
      const pricing = formatDualCurrencyPrice(amount, currency);
      if (pricing) {
        return pricing;
      }
    }
    return null;
  }

  private parseAmount(value: unknown): number | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value !== 'string') {
      return null;
    }
    const normalised = value.replace(/[^0-9.,-]/g, '').replace(',', '.');
    if (!normalised) {
      return null;
    }
    const amount = Number.parseFloat(normalised);
    return Number.isFinite(amount) ? amount : null;
  }

  private cleanText(value: string | null | undefined): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private truncate(value: string, maxLength: number): string {
    return value.length > maxLength
      ? `${value.slice(0, maxLength - 3).trimEnd()}...`
      : value;
  }

  private normaliseImageUrl(value: string | null | undefined): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_URL_LENGTH) {
      return null;
    }

    try {
      const parsed = new URL(trimmed);
      if (
        (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
        parsed.username.length > 0 ||
        parsed.password.length > 0
      ) {
        return null;
      }
      return parsed.href;
    } catch {
      return null;
    }
  }

  private ogDescription(preview: SharePreview): string {
    return preview.pricing
      ? `${preview.description} - ${preview.pricing.display}`
      : preview.description;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private appBaseUrl(): string {
    const configured =
      this.configService.get<string>('APP_URL') ??
      this.configService.get<string>('FRONTEND_URL') ??
      'http://localhost:4200';
    return configured.replace(/\/+$/, '');
  }

  /**
   * Host of the canonical share URL base. Only URLs served by this deployment
   * are treated as internal share targets so a look-alike third-party URL can
   * never be rendered as a branded HelloTalk card.
   */
  private ownHost(): string {
    try {
      return new URL(this.appBaseUrl()).host;
    } catch {
      return '';
    }
  }

  private webPath(entityType: ShareEntityType, entityId: string): string {
    const encodedId = encodeURIComponent(entityId);
    switch (entityType) {
      case 'tutor':
        return `/profile/${encodedId}`;
      case 'group':
        return `/chat/${encodedId}`;
      case 'room':
        return `/preview/room/${encodedId}`;
      case 'moment':
        return `/moments?moment=${encodedId}`;
      case 'event':
        return `/events/${encodedId}`;
    }
  }

  private deepLink(entityType: ShareEntityType, entityId: string): string {
    const encodedId = encodeURIComponent(entityId);
    switch (entityType) {
      case 'tutor':
        return `hellotalk://profile/${encodedId}`;
      case 'group':
        return `hellotalk://chat/${encodedId}`;
      case 'room':
        return `hellotalk://audio-rooms/${encodedId}`;
      case 'moment':
        return `hellotalk://moments/?moment=${encodedId}`;
      case 'event':
        return `hellotalk://events/${encodedId}`;
    }
  }
}
