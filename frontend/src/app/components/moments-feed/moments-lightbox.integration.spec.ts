import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const feedComponentSource = readFileSync(
  'src/app/components/moments-feed/moments-feed.component.ts',
  'utf-8',
);
const feedTemplate = readFileSync(
  'src/app/components/moments-feed/moments-feed.component.html',
  'utf-8',
);
const lightboxComponentSource = readFileSync(
  'src/app/components/lightbox/lightbox.component.ts',
  'utf-8',
);
const lightboxTemplate = readFileSync(
  'src/app/components/lightbox/lightbox.component.html',
  'utf-8',
);

describe('Moments lightbox integration', () => {
  it('registers the existing LightboxComponent on the Moments surface', () => {
    expect(feedComponentSource).toContain(
      "import { LightboxComponent } from '../lightbox/lightbox.component';",
    );
    expect(feedComponentSource).toMatch(/imports:\s*\[[\s\S]*LightboxComponent/);
  });

  it('opens the lightbox from the clicked Moment image with the clicked index', () => {
    expect(feedTemplate).toContain('let i = $index');
    expect(feedTemplate).toContain('(click)="openLightbox(moment.media_urls ?? [], i)"');
    expect(feedTemplate).toContain("'lightbox.imageAlt'");
  });

  it('renders and closes the shared lightbox from signal state', () => {
    expect(feedTemplate).toContain('@if (lightboxImages().length > 0)');
    expect(feedTemplate).toContain('<app-lightbox');
    expect(feedTemplate).toContain('[images]="lightboxImages()"');
    expect(feedTemplate).toContain('[initialIndex]="lightboxInitialIndex()"');
    expect(feedTemplate).toContain('(closed)="closeLightbox()"');
  });

  it('keeps image activation on a native Spartan button', () => {
    expect(feedTemplate).toMatch(
      /<button[\s\S]*?hlmBtn[\s\S]*?type="button"[\s\S]*?openLightbox\(moment\.media_urls \?\? \[\], i\)/,
    );
  });

  it('delegates modal focus, backdrop and Escape ownership to Spartan Dialog', () => {
    expect(lightboxComponentSource).toContain('HlmDialogImports');
    expect(lightboxTemplate).toContain('<hlm-dialog');
    expect(lightboxTemplate).toContain('*hlmDialogPortal');
    expect(lightboxTemplate).toContain('(stateChanged)="onDialogStateChanged($event)"');
  });
});
