// Like link-preview.real-dependencies.spec.ts this mocks none of cheerio,
// DOMPurify or JSDOM. A preview persisted with a chat message is only
// trustworthy on read if the installed sanitiser really cleans it, so the
// stand-in used by the other suites would prove nothing here.
import type { Mock } from 'vitest';
import type { HttpService } from '@nestjs/axios';
import type Redis from 'ioredis';
import type { MetricsService } from '../metrics/metrics.service';
import { LinkPreviewService } from './link-preview.service';

const PAGE_URL = 'https://example.com/post';

const stored = {
  url: PAGE_URL,
  title: 'A post',
  description: 'About a post',
  image: 'https://example.com/cover.png',
  siteName: 'Example',
};

describe('LinkPreviewService.restoreStoredPreview', () => {
  let service: LinkPreviewService;
  let httpService: { get: Mock };
  let redis: { get: Mock; set: Mock };
  let metrics: { recordLinkPreview: Mock };

  beforeEach(() => {
    httpService = { get: vi.fn() };
    redis = { get: vi.fn(), set: vi.fn() };
    metrics = { recordLinkPreview: vi.fn() };
    service = new LinkPreviewService(
      httpService as unknown as HttpService,
      redis as unknown as Redis,
      metrics as unknown as MetricsService,
    );
  });

  describe('binding to the message text', () => {
    it('returns the stored preview of the first link in the text', () => {
      expect(
        service.restoreStoredPreview(
          stored,
          'Read https://example.com/post today',
        ),
      ).toEqual(stored);
    });

    it('finds the link through punctuation, host case and CJK text', () => {
      for (const text of [
        '(see https://EXAMPLE.com/post).',
        'Look: https://example.com/post!',
        '請看https://example.com/post。謝謝',
      ]) {
        expect(service.restoreStoredPreview(stored, text)).toEqual(stored);
      }
    });

    it('matches the normalised form of a bare origin', () => {
      const origin = { ...stored, url: 'https://example.com/' };

      expect(
        service.restoreStoredPreview(origin, 'https://example.com'),
      ).toEqual(origin);
    });

    it('drops a preview once the first link in the text is another page', () => {
      expect(
        service.restoreStoredPreview(stored, 'Now read https://other.test/x'),
      ).toBeNull();
      expect(
        service.restoreStoredPreview(
          stored,
          'https://other.test/x then https://example.com/post',
        ),
      ).toBeNull();
    });

    it('drops a preview once the text has no link at all', () => {
      for (const text of ['plain words', '', null, undefined]) {
        expect(service.restoreStoredPreview(stored, text)).toBeNull();
      }
    });

    it('refuses links the scraper itself would refuse', () => {
      for (const link of [
        'http://localhost/post',
        'http://192.168.0.10/post',
        'https://example.com:8443/post',
        'https://user:secret@example.com/post',
      ]) {
        expect(
          service.restoreStoredPreview({ ...stored, url: link }, link),
        ).toBeNull();
      }
    });

    it('makes no network, cache or metric calls', () => {
      service.restoreStoredPreview(stored, 'https://example.com/post');

      expect(httpService.get).not.toHaveBeenCalled();
      expect(redis.get).not.toHaveBeenCalled();
      expect(redis.set).not.toHaveBeenCalled();
      expect(metrics.recordLinkPreview).not.toHaveBeenCalled();
    });
  });

  describe('untrusted stored values', () => {
    const text = 'https://example.com/post';

    it('ignores anything that is not an object', () => {
      for (const value of [
        null,
        undefined,
        'a string',
        42,
        true,
        [],
        [stored],
      ]) {
        expect(service.restoreStoredPreview(value, text)).toBeNull();
      }
    });

    it('ignores an object that does not describe the linked page', () => {
      for (const url of [undefined, null, 42, 'https://example.com/other']) {
        expect(
          service.restoreStoredPreview({ ...stored, url }, text),
        ).toBeNull();
      }
    });

    it('strips markup from every stored text field', () => {
      expect(
        service.restoreStoredPreview(
          {
            ...stored,
            title: '<img src=x onerror=alert(1)>Title',
            description: '<script>alert(1)</script>Description',
            siteName: '<b>Site</b>',
          },
          text,
        ),
      ).toEqual({
        ...stored,
        title: 'Title',
        description: 'Description',
        siteName: 'Site',
      });
    });

    it('keeps the rest of the preview when the image is unsafe', () => {
      for (const image of [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'http://127.0.0.1/cover.png',
        'https://user:secret@example.com/cover.png',
        'https://example.com:8443/cover.png',
        `https://example.com/${'a'.repeat(2_100)}.png`,
      ]) {
        expect(
          service.restoreStoredPreview({ ...stored, image }, text),
        ).toEqual({
          ...stored,
          image: '',
        });
      }
    });

    it('resolves a relative image against the page', () => {
      expect(
        service.restoreStoredPreview({ ...stored, image: '/img/c.png' }, text),
      ).toMatchObject({ image: 'https://example.com/img/c.png' });
    });

    it('bounds oversized fields to the scraper limits', () => {
      const preview = service.restoreStoredPreview(
        {
          ...stored,
          title: 't'.repeat(400),
          description: 'd'.repeat(1_200),
          siteName: 's'.repeat(250),
        },
        text,
      );

      expect(preview?.title).toHaveLength(300);
      expect(preview?.description).toHaveLength(1_000);
      expect(preview?.siteName).toHaveLength(200);
    });

    it('ignores fields of the wrong type', () => {
      expect(
        service.restoreStoredPreview(
          { url: PAGE_URL, title: 7, description: {}, image: [], siteName: 1 },
          text,
        ),
      ).toBeNull();
      expect(
        service.restoreStoredPreview(
          { ...stored, description: {}, image: [], siteName: 1 },
          text,
        ),
      ).toEqual({
        ...stored,
        description: '',
        image: '',
        siteName: 'example.com',
      });
    });

    it('falls back to the hostname when the site name is missing', () => {
      for (const siteName of [undefined, '', null]) {
        expect(
          service.restoreStoredPreview({ ...stored, siteName }, text),
        ).toMatchObject({ siteName: 'example.com' });
      }
    });

    it('returns null when nothing usable survives sanitising', () => {
      expect(
        service.restoreStoredPreview(
          {
            url: PAGE_URL,
            title: '<script>alert(1)</script>',
            description: '',
            image: 'javascript:alert(1)',
            siteName: 'Example',
          },
          text,
        ),
      ).toBeNull();
    });

    it('preserves multilingual and right-to-left text exactly', () => {
      const title = '日本語のタイトル 🌸 العنوان بالعربية Привет, мир';

      expect(
        service.restoreStoredPreview({ ...stored, title }, text),
      ).toMatchObject({ title });
    });

    it('does not mutate the stored value it was given', () => {
      const original = {
        ...stored,
        title: '<b>Bold</b> title',
      };
      const snapshot = structuredClone(original);

      service.restoreStoredPreview(original, text);

      expect(original).toEqual(snapshot);
    });
  });
});
