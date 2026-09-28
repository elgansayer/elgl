import { HttpModule } from '@nestjs/axios';
import { RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  MODULE_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseModule } from '../supabase/supabase.module';
import { LinkPreviewController } from './link-preview.controller';
import { LinkPreviewModule } from './link-preview.module';
import { LinkPreviewService } from './link-preview.service';

describe('Link preview NestJS contract (#1079)', () => {
  it('wires the scraper controller and service through LinkPreviewModule', () => {
    const imports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      LinkPreviewModule,
    ) as unknown[];
    const controllers = Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      LinkPreviewModule,
    ) as unknown[];
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      LinkPreviewModule,
    ) as unknown[];
    const exports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      LinkPreviewModule,
    ) as unknown[];

    expect(imports).toEqual(
      expect.arrayContaining([HttpModule, SupabaseModule]),
    );
    expect(controllers).toContain(LinkPreviewController);
    expect(providers).toContain(LinkPreviewService);
    expect(exports).toContain(LinkPreviewService);
  });

  it('exposes the authenticated GET /link-preview endpoint', () => {
    const routePath = Reflect.getMetadata(PATH_METADATA, LinkPreviewController);
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      LinkPreviewController,
    ) as unknown[];
    const handler = LinkPreviewController.prototype.getPreview;

    expect(routePath).toBe('link-preview');
    expect(guards).toContain(SupabaseAuthGuard);
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
      RequestMethod.GET,
    );
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('/');
  });

  it('delegates scraping to LinkPreviewService without rewriting the URL', async () => {
    const getPreview = vi.fn().mockResolvedValue({
      url: 'https://example.com/article?lang=ja',
      title: 'Example',
      description: '',
      image: '',
      siteName: 'example.com',
    });
    const controller = new LinkPreviewController({
      getPreview,
    } as unknown as LinkPreviewService);
    const url = 'https://example.com/article?lang=ja';

    await expect(controller.getPreview(url)).resolves.toMatchObject({ url });
    expect(getPreview).toHaveBeenCalledOnce();
    expect(getPreview).toHaveBeenCalledWith(url);
  });
});
