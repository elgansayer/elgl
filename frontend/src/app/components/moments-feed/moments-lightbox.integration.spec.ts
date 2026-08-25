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
  it('registers the shared LightboxComponent on the Moments surface', () => {
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

  it('uses pointer gestures with cancellation instead of touch-only handlers', () => {
    expect(lightboxTemplate).toContain('(pointerdown)="onPointerDown($event)"');
    expect(lightboxTemplate).toContain('(pointerup)="onPointerUp($event)"');
    expect(lightboxTemplate).toContain('(pointercancel)="onPointerCancel($event)"');
    expect(lightboxTemplate).not.toContain('(touchstart)');
    expect(lightboxTemplate).not.toContain('(touchend)');
  });

  it('keeps duplicate image URLs addressable by tracking gallery positions', () => {
    expect(lightboxTemplate).toContain('@for (img of images(); track $index; let i = $index)');
  });

  it('announces current position and exposes indicator selection semantically', () => {
    expect(lightboxTemplate).toContain('aria-live="polite"');
    expect(lightboxTemplate).toContain('[attr.aria-current]="i === currentIndex() ? \'true\' : null"');
  });

  it('keeps gallery indicators touch-sized and respects reduced motion', () => {
    expect(lightboxTemplate).toContain(
      'size="icon-touch"\n            (click)="goTo(i, $event)"',
    );
    expect(lightboxTemplate).toContain(
      'transition-all duration-300 ease-out motion-reduce:transition-none',
    );
    expect(lightboxTemplate).toContain(
      'transition-colors duration-200 motion-reduce:transition-none',
    );
  });

  it('renders explicit image loading and unavailable states', () => {
    expect(lightboxTemplate).toContain("'common.loading' | t");
    expect(lightboxTemplate).toContain("'common.loadError' | t");
    expect(lightboxTemplate).toContain('(load)="onImageLoad(img)"');
    expect(lightboxTemplate).toContain('(error)="onImageError(img)"');
  });
});
