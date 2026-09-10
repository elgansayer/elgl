import { AssertCheckFn } from './types';

export function verifyLingQ(assertCheck: AssertCheckFn) {
  // 1. Verify LingQ Universal Tokenisation (Intl.Segmenter)
  try {
    const textEn =
      'HelloTalk tokenises every word seamlessly without em dashes.';
    const segmenterEn = new Intl.Segmenter('en-GB', { granularity: 'word' });
    const tokensEn = Array.from(segmenterEn.segment(textEn))
      .filter((s) => s.isWordLike)
      .map((s) => s.segment);
    assertCheck(
      'LingQ Intl.Segmenter (British English Tokenisation)',
      tokensEn.includes('tokenises') && tokensEn.includes('word'),
      `Extracted tokens: ${tokensEn.join(', ')}`,
    );

    const textJa = '継続は力なり';
    const segmenterJa = new Intl.Segmenter('ja-JP', { granularity: 'word' });
    const tokensJa = Array.from(segmenterJa.segment(textJa)).map(
      (s) => s.segment,
    );
    assertCheck(
      'LingQ Intl.Segmenter (Japanese/RTL Multilingual Tokenisation)',
      tokensJa.length >= 2,
      `Extracted Japanese tokens: ${tokensJa.join(' | ')}`,
    );
  } catch (e: unknown) {
    const err = e as Error;
    assertCheck('LingQ Intl.Segmenter API Support', false, err.message);
  }
}
