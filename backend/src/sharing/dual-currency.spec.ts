import { describe, expect, it } from 'vitest';
import { formatDualCurrencyPrice } from './dual-currency';

describe('formatDualCurrencyPrice', () => {
  it('renders a GBP catalogue value in both currencies', () => {
    expect(formatDualCurrencyPrice(10, 'GBP')).toEqual({
      ukp: 10,
      usd: 12.5,
      display: '10 UKP / 12.50 USD',
    });
  });

  it('renders a USD catalogue value in both currencies', () => {
    expect(formatDualCurrencyPrice(12.5, 'USD')).toEqual({
      ukp: 10,
      usd: 12.5,
      display: '10 UKP / 12.50 USD',
    });
  });

  it.each(['UKP', '£', 'gbp'])('accepts the %s GBP alias', (currency) => {
    expect(formatDualCurrencyPrice(8, currency)?.display).toBe(
      '8 UKP / 10.00 USD',
    );
  });

  it.each([null, undefined, 0, -5, Number.NaN, Number.POSITIVE_INFINITY])(
    'returns null for an unusable amount: %s',
    (amount) => {
      expect(formatDualCurrencyPrice(amount, 'GBP')).toBeNull();
    },
  );

  it.each(['EUR', 'JPY', '', null])(
    'returns null for an unsupported currency: %s',
    (currency) => {
      expect(formatDualCurrencyPrice(10, currency)).toBeNull();
    },
  );
});
