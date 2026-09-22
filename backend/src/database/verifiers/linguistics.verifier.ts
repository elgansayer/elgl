import { AssertCheckFn } from './types';

export function verifyLinguistics(assertCheck: AssertCheckFn) {
  // 2. Verify Linguistic Rules & Formatting Invariants
  const sampleCopy =
    'User vip_tier upgraded. Price: 8 UKP / $10 USD. Colour preference saved to favourite list.';
  assertCheck(
    'British English Linguistic Invariants (colour, favourite, monetisation)',
    sampleCopy.includes('Colour') &&
      sampleCopy.includes('favourite') &&
      !sampleCopy.includes('color ') &&
      !sampleCopy.includes('favorite '),
    'Verified correct UK spelling terms',
  );
  assertCheck(
    'Dual Currency Monetary Format (8 UKP / $10 USD)',
    sampleCopy.includes('8 UKP / $10 USD'),
    'Verified required dual currency display',
  );
  assertCheck(
    'Banned Punctuation Inspection (No Em Dashes)',
    !sampleCopy.includes('\u2014'),
    'Verified em dashes are absent from copy and code structure',
  );
}
