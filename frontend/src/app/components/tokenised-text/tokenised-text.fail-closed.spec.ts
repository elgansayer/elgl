import { describe, expect, it } from 'vitest';

import { tokeniseText } from './tokenised-text.component';

describe('tokeniseText fail-closed fallback', () => {
  it('preserves the original text when requested and default locale segmentation both fail', () => {
    let constructorAttempts = 0;

    class AlwaysFailingSegmenter {
      constructor() {
        constructorAttempts += 1;
        throw new RangeError('Segmenter construction failed');
      }
    }

    const tokens = tokeniseText(
      'Still readable after segmentation failure',
      'ja',
      AlwaysFailingSegmenter as unknown as typeof Intl.Segmenter,
    );

    expect(constructorAttempts).toBe(2);
    expect(tokens).toEqual([
      {
        segment: 'Still readable after segmentation failure',
        isWordLike: false,
        index: 0,
      },
    ]);
  });
});
