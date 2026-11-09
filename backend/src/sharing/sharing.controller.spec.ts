import { describe, expect, it, vi } from 'vitest';
import { SharingController } from './sharing.controller';
import type { SharingService } from './sharing.service';
import type { SharePreview } from './sharing.types';

const preview: SharePreview = {
  entityType: 'event',
  entityId: 'event-1',
  title: 'Tokyo Language Cafe',
  description: 'Meet other learners',
  imageUrl: null,
  siteName: 'HelloTalk',
  shareUrl: 'https://hellotalk.example/api/sharing/og/event/event-1',
  webUrl: '/events/event-1',
  deepLink: 'hellotalk://events/event-1',
  pricing: null,
};

function createController() {
  const service = {
    getPreview: vi.fn().mockResolvedValue(preview),
    getShareLink: vi.fn().mockResolvedValue({
      entityType: 'event',
      entityId: 'event-1',
      shareUrl: preview.shareUrl,
      webUrl: preview.webUrl,
      deepLink: preview.deepLink,
    }),
    renderOpenGraphHtml: vi.fn().mockReturnValue('<html></html>'),
  };
  return {
    controller: new SharingController(service as unknown as SharingService),
    service,
  };
}

describe('SharingController', () => {
  it('delegates public preview requests', async () => {
    const { controller, service } = createController();

    await expect(
      controller.getPreview({ entityType: 'event', entityId: 'event-1' }),
    ).resolves.toEqual(preview);
    expect(service.getPreview).toHaveBeenCalledWith('event', 'event-1');
  });

  it('renders the OpenGraph document from the resolved preview', async () => {
    const { controller, service } = createController();

    await expect(
      controller.getOpenGraph({ entityType: 'event', entityId: 'event-1' }),
    ).resolves.toBe('<html></html>');
    expect(service.getPreview).toHaveBeenCalledWith('event', 'event-1');
    expect(service.renderOpenGraphHtml).toHaveBeenCalledWith(preview);
  });

  it('returns the authenticated share link payload', async () => {
    const { controller, service } = createController();

    await expect(
      controller.getShareLink({ entityType: 'event', entityId: 'event-1' }),
    ).resolves.toMatchObject({
      shareUrl: preview.shareUrl,
      webUrl: preview.webUrl,
      deepLink: preview.deepLink,
    });
    expect(service.getShareLink).toHaveBeenCalledWith('event', 'event-1');
  });
});
