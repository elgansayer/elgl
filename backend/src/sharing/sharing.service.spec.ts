import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { SharingService } from './sharing.service';
import type { SupabaseService } from '../supabase/supabase.service';

type Row = Record<string, unknown> | null;
type TableRows = Record<string, Row>;

function createService(rows: TableRows) {
  let currentTable = '';
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockImplementation(() => {
      return Promise.resolve({ data: rows[currentTable] ?? null, error: null });
    }),
  };
  const from = vi.fn().mockImplementation((table: string) => {
    currentTable = table;
    return query;
  });
  const config = {
    get: vi.fn().mockImplementation((key: string) => {
      if (key === 'APP_URL') return 'https://hellotalk.example/';
      return undefined;
    }),
  };

  return new SharingService(
    { getClient: () => ({ from }) } as unknown as SupabaseService,
    config as unknown as ConfigService,
  );
}

describe('SharingService', () => {
  it('resolves a tutor profile into a dual-currency share preview', async () => {
    const service = createService({
      users: {
        id: '9f1d0f8e-1d1f-4f1a-9e0e-1a2b3c4d5e6f',
        display_name: 'Ana',
        business_name: 'Ana Spanish',
        bio_text: 'Patient Spanish tutor',
        avatar_url: 'https://cdn.example.com/ana.png',
        target_languages: ['es'],
        profile_visibility: 'everyone',
        catalog: [{ price: '10', currency: 'GBP' }],
      },
    });

    const preview = await service.getPreview(
      'tutor',
      '9f1d0f8e-1d1f-4f1a-9e0e-1a2b3c4d5e6f',
    );

    expect(preview).toMatchObject({
      entityType: 'tutor',
      title: 'Ana Spanish',
      description: 'Patient Spanish tutor',
      imageUrl: 'https://cdn.example.com/ana.png',
      siteName: 'HelloTalk',
      webUrl: '/profile/9f1d0f8e-1d1f-4f1a-9e0e-1a2b3c4d5e6f',
      deepLink: 'hellotalk://profile/9f1d0f8e-1d1f-4f1a-9e0e-1a2b3c4d5e6f',
      pricing: { ukp: 10, usd: 12.5, display: '10 UKP / 12.50 USD' },
    });
    expect(preview.shareUrl).toBe(
      'https://hellotalk.example/api/sharing/og/tutor/9f1d0f8e-1d1f-4f1a-9e0e-1a2b3c4d5e6f',
    );
  });

  it('resolves groups, live rooms, moments and events to in-app routes', async () => {
    const group = await createService({
      groups: {
        id: 'group-1',
        name: 'Spanish Learners',
        description: 'A group',
      },
    }).getPreview('group', 'group-1');
    expect(group.webUrl).toBe('/chat/group-1');

    const room = await createService({
      audio_rooms: {
        id: 'room-1',
        title: 'Morning Spanish',
        language_pair: 'en-es',
        topic_tag: 'conversation',
        is_private: false,
      },
    }).getPreview('room', 'room-1');
    expect(room.webUrl).toBe('/preview/room/room-1');
    expect(room.description).toBe('en-es - conversation');

    const moment = await createService({
      moments: {
        id: 'moment-1',
        text_content: 'Practise with me',
        media_urls: ['https://cdn.example.com/moment.png'],
      },
    }).getPreview('moment', 'moment-1');
    expect(moment.webUrl).toBe('/moments?moment=moment-1');
    expect(moment.imageUrl).toBe('https://cdn.example.com/moment.png');

    const event = await createService({
      events: {
        id: 'event-1',
        title: 'Tokyo Language Cafe',
        description: 'Meet learners in Tokyo',
      },
    }).getPreview('event', 'event-1');
    expect(event.webUrl).toBe('/events/event-1');
    expect(event.deepLink).toBe('hellotalk://events/event-1');
  });

  it('hides hidden profiles, private rooms and expired ephemeral moments', async () => {
    await expect(
      createService({
        users: { id: 'u1', profile_visibility: 'hidden' },
      }).getPreview('tutor', 'u1'),
    ).rejects.toBeInstanceOf(NotFoundException);

    await expect(
      createService({
        users: { id: 'u2', profile_visibility: 'vips_only' },
      }).getPreview('tutor', 'u2'),
    ).rejects.toBeInstanceOf(NotFoundException);

    await expect(
      createService({
        users: { id: 'u3', is_deleted: true },
      }).getPreview('tutor', 'u3'),
    ).rejects.toBeInstanceOf(NotFoundException);

    await expect(
      createService({
        users: { id: 'u4', scheduled_for_deletion_at: '2026-01-01T00:00:00Z' },
      }).getPreview('tutor', 'u4'),
    ).rejects.toBeInstanceOf(NotFoundException);

    await expect(
      createService({
        audio_rooms: { id: 'r1', is_private: true },
      }).getPreview('room', 'r1'),
    ).rejects.toBeInstanceOf(NotFoundException);

    await expect(
      createService({
        moments: {
          id: 'm1',
          is_ephemeral: true,
          expires_at: '2000-01-01T00:00:00.000Z',
        },
      }).getPreview('moment', 'm1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('escapes untrusted OpenGraph metadata and advertises dual pricing', async () => {
    const service = createService({
      users: {
        id: 'u1',
        display_name: '<script>alert(1)</script>',
        bio_text: '"quoted" & <b>bold</b>',
        catalog: [{ price: 10, currency: 'GBP' }],
      },
    });
    const preview = await service.getPreview('tutor', 'u1');
    const html = service.renderOpenGraphHtml(preview);

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('property="og:title"');
    expect(html).toContain('product:price:amount');
    expect(html).toContain('10 UKP / 12.50 USD');
    expect(html).toContain(
      '<meta http-equiv="refresh" content="0; url=https://hellotalk.example/profile/u1">',
    );
  });

  it('recognises its own OpenGraph share URLs and rejects other URLs', () => {
    const service = createService({});

    expect(
      service.parseShareUrl(
        'https://hellotalk.example/api/sharing/og/event/abc-1?ref=friend',
      ),
    ).toEqual({ entityType: 'event', entityId: 'abc-1' });
    expect(
      service.parseShareUrl('https://example.com/api/sharing/og/event/abc-1'),
    ).toBeNull();
    expect(
      service.parseShareUrl('https://hellotalk.example/events/abc-1'),
    ).toBeNull();
    expect(
      service.parseShareUrl(
        'https://hellotalk.example/api/sharing/og/user/abc-1',
      ),
    ).toBeNull();
    expect(service.parseShareUrl('javascript:alert(1)')).toBeNull();
  });

  it('returns an internal link preview only for known share targets', async () => {
    const service = createService({
      events: { id: 'event-1', title: 'Event', description: 'Details' },
    });

    const preview = await service.getLinkPreviewForShareUrl(
      'https://hellotalk.example/api/sharing/og/event/event-1',
    );
    expect(preview).toMatchObject({
      url: 'https://hellotalk.example/api/sharing/og/event/event-1',
      title: 'Event',
      description: 'Details',
      siteName: 'HelloTalk',
      share: {
        entityType: 'event',
        entityId: 'event-1',
        webUrl: '/events/event-1',
        deepLink: 'hellotalk://events/event-1',
      },
    });

    await expect(
      service.getLinkPreviewForShareUrl('https://example.com/article'),
    ).resolves.toBeNull();
    await expect(
      createService({}).getLinkPreviewForShareUrl(
        'https://hellotalk.example/api/sharing/og/event/missing',
      ),
    ).resolves.toBeNull();
  });
});
