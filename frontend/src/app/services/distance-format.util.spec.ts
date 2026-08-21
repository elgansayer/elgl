import { describe, expect, it } from 'vitest';
import { formatApproximateDistance } from './distance-format.util';

describe('formatApproximateDistance', () => {
  it('uses privacy-rounded metric units for non-US locales', () => {
    expect(formatApproximateDistance(523, 'en-GB')).toBe('~500 m');
    expect(formatApproximateDistance(5_240, 'en-GB')).toBe('~5 km');
    expect(formatApproximateDistance(12_620, 'ja')).toBe('~13 km');
  });

  it('uses privacy-rounded imperial units for en-US', () => {
    expect(formatApproximateDistance(523, 'en-US')).toBe('~1,500 ft');
    expect(formatApproximateDistance(5_240, 'en-US')).toBe('~3.5 mi');
    expect(formatApproximateDistance(20_000, 'en-US')).toBe('~12 mi');
  });

  it('does not render invalid or missing distances', () => {
    expect(formatApproximateDistance(undefined, 'en-GB')).toBe('');
    expect(formatApproximateDistance(Number.NaN, 'en-GB')).toBe('');
    expect(formatApproximateDistance(-1, 'en-GB')).toBe('');
  });
});
