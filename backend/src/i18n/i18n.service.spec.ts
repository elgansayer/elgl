import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from './i18n.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('I18nService', () => {
  let service: I18nService;
  let supabaseService: { getClient: Mock };

  beforeEach(async () => {
    supabaseService = { getClient: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        I18nService,
        { provide: SupabaseService, useValue: supabaseService },
      ],
    }).compile();

    service = module.get(I18nService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('normalises regional and unsupported locales to a shipped dictionary', () => {
    expect(service.normalizeLocale('es-MX')).toBe('es');
    expect(service.normalizeLocale('fr-FR')).toBe('fr');
    expect(service.normalizeLocale('de')).toBe('de');
    expect(service.normalizeLocale('xx-YY')).toBe('en-GB');
    expect(service.normalizeLocale('')).toBe('en-GB');
    expect(service.normalizeLocale(null)).toBe('en-GB');
  });

  it('translates backend copy in the recipient locale', () => {
    expect(service.translate('notifications.title.follow', 'es')).toBe(
      'Nuevo seguidor',
    );
    expect(service.translate('notifications.body.like_moment', 'es')).toBe(
      'A alguien le gustó tu momento',
    );
  });

  it('interpolates parameters without touching unknown placeholders', () => {
    expect(service.translate('chat.contactShare', 'es', { name: 'Ana' })).toBe(
      'Mira el perfil de Ana',
    );
    expect(
      service.translate('chat.contactShare', 'es', { other: 'x' }),
    ).toContain('{{name}}');
  });

  it('falls back to English and echoes unknown keys', () => {
    expect(service.translate('notifications.fallback.title', 'xx')).toBe(
      'New Notification',
    );
    expect(service.translate('missing.key', 'es')).toBe('missing.key');
  });

  it('resolves the stored recipient locale', async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { ui_locale: 'es' }, error: null });
    supabaseService.getClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle })),
        })),
      })),
    });

    await expect(service.resolveUserLocale('user-1')).resolves.toBe('es');
  });

  it('falls back to en-GB when the recipient has no locale row', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    supabaseService.getClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle })),
        })),
      })),
    });

    await expect(service.resolveUserLocale('user-1')).resolves.toBe('en-GB');
  });

  it('fails open to en-GB when the locale lookup throws', async () => {
    supabaseService.getClient.mockImplementation(() => {
      throw new Error('supabase offline');
    });

    await expect(service.resolveUserLocale('user-1')).resolves.toBe('en-GB');
  });
});
